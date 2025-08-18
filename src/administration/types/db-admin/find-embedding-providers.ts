// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { ModelLifecycleStatus } from '@/src/administration/types/db-admin/common.js';
import type { CommandOptions, LitUnion } from '@/src/lib/index.js';

/**
 * Options for finding embedding providers.
 *
 * @field filterModelStatus - Filter models by their lifecycle status. If not provided, defaults to 'SUPPORTED' only. Use empty string '' to include all statuses.
 *
 * @see DbAdmin.findEmbeddingProviders
 *
 * @public
 */
export interface FindEmbeddingProvidersOptions extends CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }> {
  /**
   * Filter models by their lifecycle status.
   *
   * - If not provided: defaults to `'SUPPORTED'` only
   * - If set to `''`: includes all statuses (`'SUPPORTED'`, `'DEPRECATED'`, `'END_OF_LIFE'`)
   * - If set to specific status: includes only models with that status
   *
   * @example
   * ```ts
   * // Only supported models (default behavior)
   * { filterModelStatus: 'SUPPORTED' }
   *
   * // All models regardless of status
   * { filterModelStatus: '' }
   *
   * // Only deprecated models
   * { filterModelStatus: 'DEPRECATED' }
   * ```
   */
  filterModelStatus?: ModelLifecycleStatus | '';
}

/**
 * The overarching result containing the `embeddingProviders` map.
 *
 * @field embeddingProviders - Map of embedding provider names to info about said provider.
 *
 * @see DbAdmin.findEmbeddingProviders
 *
 * @public
 */
export interface FindEmbeddingProvidersResult {
  /**
   * A map of embedding provider names (e.g. `openai`), to information about said provider (e.g. models/auth).
   *
   * @example
   * ```ts
   * {
   *   openai: {
   *     displayName: 'OpenAI',
   *     ...,
   *   }
   * }
   * ```
   */
  embeddingProviders: Record<string, EmbeddingProviderInfo>,
}

/**
 * Info about a specific embedding provider
 *
 * @field displayName - The prettified name of the provider (as shown in the portal)
 * @field url - The embeddings endpoint used for the provider
 * @field supportedAuthentication - Enabled methods of auth for the provider
 * @field parameters - Any additional parameters the provider may take in
 * @field models - The specific models that the provider supports
 *
 * @see FindEmbeddingProvidersResult
 *
 * @public
 */
export interface EmbeddingProviderInfo {
  /**
   * The prettified name of the provider (as shown in the Astra portal).
   *
   * @example
   * ```ts
   * // openai.displayName:
   * 'OpenAI'
   * ```
   */
  displayName: string,
  /**
   * The embeddings endpoint used for the provider.
   *
   * May use a Python f-string-style string interpolation pattern for certain providers which take in additional
   * parameters (such as `huggingfaceDedicated` or `azureOpenAI`).
   *
   * @example
   * ```ts
   * // openai.url:
   * 'https://api.openai.com/v1/'
   *
   * // huggingfaceDedicated.url:
   * 'https://{endpointName}.{regionName}.{cloudName}.endpoints.huggingface.cloud/embeddings'
   * ```
   */
  url: string,
  /**
   * Supported methods of authentication for the provider.
   *
   * Possible methods include `HEADER`, `SHARED_SECRET`, and `NONE`.
   *
   * - `HEADER`: Authentication using direct API keys passed through headers on every Data API call.
   * See {@link EmbeddingHeadersProvider} for more info.
   * ```ts
   * const collections = await db.createCollection('my_coll', {
   *   vector: {
   *     service: {
   *       provider: 'openai',
   *       modelName: 'text-embedding-3-small',
   *       authentication: {
   *         // Name of the key in Astra portal's OpenAI integration (KMS).
   *         providerKey: '*KEY_NAME*',
   *       },
   *     },
   *   },
   * });
   * ```
   *
   * - `SHARED_SECRET`: Authentication tied to a collections at collections creation time using the Astra KMS.
   * ```ts
   * const collections = await db.collections('my_coll', {
   *   // Not tied to the collections; can be different every time.
   *   embeddingApiKey: 'sk-...',
   * });
   * ```
   *
   * - `NONE`: For when a client doesn't need authentication to use (e.g. nvidia).
   * ```ts
   * const collections = await db.createCollection('my_coll', {
   *   vector: {
   *     service: {
   *       provider: 'nvidia',
   *       modelName: 'NV-Embed-QA',
   *     },
   *   },
   * });
   * ```
   *
   * @example
   * ```ts
   * // openai.supportedAuthentication.HEADER:
   * {
   *   enabled: true,
   *   tokens: [{
   *     accepted: 'x-embedding-api-key',
   *     forwarded: 'Authorization',
   *   }],
   * }
   * ```
   */
  supportedAuthentication: Record<LitUnion<'HEADER' | 'SHARED_SECRET' | 'NONE'>, EmbeddingProviderAuthInfo>,
  /**
   * Any additional, arbitrary parameters the provider may take in. May or may not be required.
   *
   * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`).
   *
   * @example
   * ```ts
   * // openai.parameters[1]
   * {
   *   name: 'projectId',
   *   type: 'STRING',
   *   required: false,
   *   defaultValue: '',
   *   validation: {},
   *   help: 'Optional, OpenAI Project ID. If provided passed as `OpenAI-Project` header.',
   * }
   * ```
   */
  parameters: EmbeddingProviderProviderParameterInfo[],
  /**
   * The specific models that the provider supports.
   *
   * May include an `endpoint-defined-model` for some providers, such as `huggingfaceDedicated`, where the model
   * may be truly arbitrary.
   *
   * @example
   * ```ts
   * // nvidia.models[0]
   * {
   *   name: 'NV-Embed-QA',
   *   vectorDimension: 1024,
   *   parameters: [],
   * }
   *
   * // huggingfaceDedicated.models[0]
   * {
   *   name: 'endpoint-defined-model',
   *   vectorDimension: null,
   *   parameters: [{
   *     name: 'vectorDimension',
   *     type: 'number',
   *     required: true,
   *     defaultValue: '',
   *     validation: {
   *       numericRange: [2, 3072],
   *     },
   *     help: 'Vector dimension to use in the database, should be the same as ...',
   *   }],
   * }
   * ```
   */
  models: EmbeddingProviderModelInfo[],
}

/**
 * Information about a specific auth method, such as `HEADER`, `SHARED_SECRET`, or `NONE` for a specific provider. See
 * {@link EmbeddingProviderInfo.supportedAuthentication} for more information.
 *
 * See {@link EmbeddingHeadersProvider} for more info about the `HEADER` auth through the client.
 *
 * @example
 * ```ts
 * // openai.supportedAuthentication.HEADER:
 * {
 *   enabled: true,
 *   tokens: [{
 *     accepted: 'x-embedding-api-key',
 *     forwarded: 'Authorization',
 *   }],
 * }
 * ```
 *
 * @field enabled - Whether this method of auth is supported for the provider.
 * @field tokens - Additional info on how exactly this method of auth is supposed to be used.
 *
 * @see EmbeddingProviderInfo
 *
 * @public
 */
export interface EmbeddingProviderAuthInfo {
  /**
   * Whether this method of auth is supported for the provider.
   */
  enabled: boolean,
  /**
   * Additional info on how exactly this method of auth is supposed to be used.
   *
   * See {@link EmbeddingHeadersProvider} for more info about the `HEADER` auth through the client.
   *
   * Will be an empty array if `enabled` is `false`.
   */
  tokens: EmbeddingProviderTokenInfo[],
}

/**
 * Info on how exactly a method of auth may be used.
 *
 * @example
 * ```ts
 * // openai.supportedAuthentication.HEADER.tokens[0]:
 * {
 *   accepted: 'x-embedding-api-key',
 *   forwarded: 'Authorization',
 * }
 * ```
 *
 * @field accepted - The accepted token
 * @field forwarded - How the token is forwarded to the embedding provider
 *
 * @see EmbeddingProviderAuthInfo
 *
 * @public
 */
export interface EmbeddingProviderTokenInfo {
  /**
   * The accepted token.
   *
   * May most often be `providerKey` for `SHARED_SECRET`, or `x-embedding-api-key` for `HEADER`.
   *
   * See {@link EmbeddingHeadersProvider} for more info about the `HEADER` auth through the client.
   */
  accepted: string,
  /**
   * How the token is forwarded to the embedding provider.
   */
  forwarded: string,
}

/**
 * Info about any additional, arbitrary parameter the model may take in. May or may not be required.
 *
 * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`, which should be
 * set in the upper-level `dimension: number` field).
 *
 * @example
 * ```ts
 * // openai.parameters[1]
 * {
 *   name: 'vectorDimension',
 *   type: 'number',
 *   required: true,
 *   defaultValue: '1536',
 *   validation: { numericRange: [2, 1536] },
 *   help: 'Vector dimension to use in the database and when calling OpenAI.',
 * }
 * ```
 *
 * @field name - The name of the parameter to be passed in.
 * @field type - The datatype of the parameter.
 * @field required - Whether the parameter is required to be passed in.
 * @field defaultValue - The default value of the provider, or an empty string if there is none.
 * @field validation - Validations that may be done on the inputted value.
 * @field help - Any additional help text/information about the parameter.
 *
 * @see EmbeddingProviderInfo
 * @see EmbeddingProviderModelInfo
 *
 * @public
 */
export interface EmbeddingProviderModelParameterInfo {
  /**
   * The name of the parameter to be passed in.
   *
   * The one exception is the `vectorDimension` parameter, which should be passed into the `dimension` field of the
   * `vector` block in {@link CollectionVectorOptions}/{@link TableVectorColumnDefinition}.
   *
   * @example
   * ```ts
   * // huggingface.parameters[0].name
   * endpointName
   * ```
   */
  name: string,
  /**
   * The datatype of the parameter.
   *
   * Commonly `number` or `STRING`.
   *
   * @example
   * ```ts
   * // huggingface.parameters[0].type
   * STRING
   * ```
   */
  type: string,
  /**
   * Whether the parameter is required to be passed in.
   *
   * @example
   * ```ts
   * // huggingface.parameters[0].required
   * true
   * ```
   */
  required: boolean,
  /**
   * The default value of the provider, or an empty string if there is none.
   *
   * Will always be in string form (even if the `type` is `'number'`).
   *
   * @example
   * ```ts
   * // huggingface.parameters[0].defaultValue
   * ''
   * ```
   */
  defaultValue: string,
  /**
   * Validations that may be done on the inputted value.
   *
   * Commonly either an empty record, or `{ numericRange: [<min>, <max>] }`.
   *
   * @example
   * ```ts
   * // huggingface.parameters[0].validation
   * {}
   * ```
   */
  validation: Record<string, unknown>[],
  /**
   * Any additional help text/information about the parameter.
   *
   * @example
   * ```ts
   * // huggingface.parameters[0].help
   * 'The name of your Hugging Face dedicated endpoint, the first part of the Endpoint URL.'
   * ```
   */
  help: string,
}

/**
 * Info about any additional, arbitrary parameter the provider may take in. May or may not be required.
 *
 * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`, which should be
 * set in the upper-level `dimension: number` field).
 *
 * @example
 * ```ts
 * // openai.parameters[1]
 * {
 *   name: 'projectId',
 *   type: 'STRING',
 *   required: false,
 *   defaultValue: '',
 *   validation: {},
 *   help: 'Optional, OpenAI Project ID. If provided passed as `OpenAI-Project` header.',
 *   displayName: 'Organization ID',
 *   hint: 'Add an (optional) organization ID',
 * }
 * ```
 *
 * @field name - The name of the parameter to be passed in.
 * @field type - The datatype of the parameter.
 * @field required - Whether the parameter is required to be passed in.
 * @field defaultValue - The default value of the provider, or an empty string if there is none.
 * @field validation - Validations that may be done on the inputted value.
 * @field help - Any additional help text/information about the parameter.
 * @field displayName - Display name for the parameter.
 * @field hint - Hint for parameter usage.
 *
 * @see EmbeddingProviderInfo
 * @see EmbeddingProviderModelInfo
 *
 * @public
 */
export interface EmbeddingProviderProviderParameterInfo extends EmbeddingProviderModelParameterInfo {
  /**
   * Display name for the parameter.
   *
   * @example
   * ```ts
   * // openai.parameters[0].displayName
   * 'Organization ID'
   * ```
   */
  displayName: string,
  /**
   * Hint for parameter usage.
   *
   * @example
   * ```ts
   * // openai.parameters[0].hint
   * 'Add an (optional) organization ID'
   * ```
   */
  hint: string,
}

/**
 * The specific models that the provider supports.
 *
 * May include an `endpoint-defined-model` for some providers, such as `huggingfaceDedicated`, where the model
 * may be truly arbitrary.
 *
 * @example
 * ```ts
 * // nvidia.models[0]
 * {
 *   name: 'NV-Embed-QA',
 *   vectorDimension: 1024,
 *   parameters: [],
 * }
 * ```
 *
 * @field name - The name of the model to use
 * @field vectorDimension - The preset, exact vector dimension to be used (if applicable)
 * @field parameters - Any additional parameters the model may take in
 *
 * @see EmbeddingProviderInfo
 *
 * @public
 */
export interface EmbeddingProviderModelInfo {
  /**
   * The name of the model to use.
   *
   * May be `endpoint-defined-model` for some providers, such as `huggingfaceDedicated`, where the model
   * may be truly arbitrary.
   *
   * @example
   * ```ts
   * // openai.models[0].name
   * 'text-embedding-3-small'
   *
   * // huggingfaceDedicated.models[0].name
   * 'endpoint-defined-model'
   * ```
   */
  name: string,
  /**
   * The preset, exact vector dimension to be used (if applicable).
   *
   * If not present, a `vectorDimension` parameter will be present in the `model.parameters` block.
   *
   * @example
   * ```ts
   * // openai.models[3].vectorDimension (text-embedding-ada-002)
   * 1536
   *
   * // huggingfaceDedicated.models[0].vectorDimension (endpoint-defined-model)
   * null
   * ```
   */
  vectorDimension: number | null,
  /**
   * Any additional, arbitrary parameters the modem may take in. May or may not be required.
   *
   * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`).
   *
   * @example
   * ```ts
   * // openai.models[0].parameters[0] (text-embedding-3-small)
   * {
   *   name: 'vectorDimension',
   *   type: 'number',
   *   required: true,
   *   defaultValue: '1536',
   *   validation: { numericRange: [2, 1536] },
   *   help: 'Vector dimension to use in the database and when calling OpenAI.',
   * }
   * ```
   */
  parameters: EmbeddingProviderModelParameterInfo[],
  /**
   * Information about the model's API support status.
   *
   * @example
   * ```ts
   * // openai.models[0].apiModelSupport
   * { status: 'SUPPORTED' }
   * ```
   */
  apiModelSupport: EmbeddingProviderModelApiSupportInfo,
}

/**
 * Information about the model's API support status and lifecycle.
 *
 * @field status - The current lifecycle status of the model
 *
 * @see EmbeddingProviderModelInfo
 *
 * @public
 */
export interface EmbeddingProviderModelApiSupportInfo {
  /**
   * The current lifecycle status of the model.
   *
   * @example
   * ```ts
   * // openai.models[0].apiModelSupport.status
   * 'SUPPORTED'
   * ```
   */
  status: ModelLifecycleStatus,
}
