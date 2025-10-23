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
 * Options for finding reranking providers.
 *
 * @field filterModelStatus - Filter models by their lifecycle status. If not provided, defaults to `'SUPPORTED'` only. Use empty string `''` to include all statuses.
 *
 * @see DbAdmin.findRerankingProviders
 *
 * @public
 */
export interface FindRerankingProvidersOptions extends CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }> {
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
 * The overarching result containing the `rerankingProviders` map.
 *
 * @field rerankingProviders - Map of reranking provider names to info about said provider.
 *
 * @see DbAdmin.findRerankingProviders
 *
 * @public
 */
export interface FindRerankingProvidersResult {
  /**
   * A map of reranking provider names (e.g. `nvidia`), to information about said provider (e.g. models/auth).
   *
   * @example
   * ```ts
   * {
   *   nvidia: {
   *     displayName: 'Nvidia',
   *     ...,
   *   }
   * }
   * ```
   */
  rerankingProviders: Record<string, RerankingProviderInfo>,
}

/**
 * Info about a specific reranking provider
 *
 * @field displayName - The prettified name of the provider (as shown in the portal)
 * @field isDefault - Whether this provider is the default for reranking
 * @field supportedAuthentication - Enabled methods of auth for the provider
 * @field models - The specific models that the provider supports
 *
 * @see FindRerankingProvidersResult
 *
 * @public
 */
export interface RerankingProviderInfo {
  /**
   * The prettified name of the provider (as shown in the Astra portal).
   *
   * @example
   * ```ts
   * // nvidia.displayName:
   * 'Nvidia'
   * ```
   */
  displayName: string,
  /**
   * Whether this provider is the default for reranking.
   *
   * @example
   * ```ts
   * // nvidia.isDefault:
   * true
   * ```
   */
  isDefault: boolean,
  /**
   * Supported methods of authentication for the provider.
   *
   * Possible methods include `'HEADER'`, `'SHARED_SECRET'`, and `'NONE'`.
   *
   * - `'HEADER'`: Authentication using direct API keys passed through headers on every Data API call.
   * - `'SHARED_SECRET'`: Authentication tied to a collection at collections creation time using the Astra KMS.
   * - `'NONE'`: For when a client doesn't need authentication to use (e.g. nvidia).
   *
   * @example
   * ```ts
   * // nvidia.supportedAuthentication.NONE:
   * {
   *   enabled: true,
   *   tokens: [],
   * }
   * ```
   */
  supportedAuthentication: Record<LitUnion<'HEADER' | 'SHARED_SECRET' | 'NONE'>, RerankingProviderAuthInfo>,
  /**
   * The specific models that the provider supports.
   *
   * @example
   * ```ts
   * // nvidia.models[0]
   * {
   *   name: 'nvidia/llama-3.2-nv-rerankqa-1b-v2',
   *   isDefault: true,
   *   url: 'https://...',
   *   properties: null,
   *   apiModelSupport: {
   *     status: 'SUPPORTED',
   *   },
   * }
   * ```
   */
  models: RerankingProviderModelInfo[],
  /**
   * Additional parameters for the provider, if any.
   */
  parameters?: Record<string, unknown>,
}

/**
 * Information about a specific auth method, such as `'HEADER'`, `'SHARED_SECRET'`, or `'NONE'` for a specific provider. See
 * {@link RerankingProviderInfo.supportedAuthentication} for more information.
 *
 * @example
 * ```ts
 * // nvidia.supportedAuthentication.NONE:
 * {
 *   enabled: true,
 *   tokens: [],
 * }
 * ```
 *
 * @field enabled - Whether this method of auth is supported for the provider.
 * @field tokens - Additional info on how exactly this method of auth is supposed to be used.
 *
 * @see RerankingProviderInfo
 *
 * @public
 */
export interface RerankingProviderAuthInfo {
  /**
   * Whether this method of auth is supported for the provider.
   */
  enabled: boolean,
  /**
   * Additional info on how exactly this method of auth is supposed to be used.
   *
   * Will be an empty array if `enabled` is `false`.
   */
  tokens: RerankingProviderTokenInfo[],
}

/**
 * Info on how exactly a method of auth may be used.
 *
 * @field accepted - The accepted token
 * @field forwarded - How the token is forwarded to the reranking provider
 *
 * @see RerankingProviderAuthInfo
 *
 * @public
 */
export interface RerankingProviderTokenInfo {
  /**
   * The accepted token.
   *
   * May most often be `providerKey` for `SHARED_SECRET`, or specific header names for `HEADER`.
   */
  accepted: string,
  /**
   * How the token is forwarded to the reranking provider.
   */
  forwarded: string,
}

/**
 * The specific models that the provider supports for reranking.
 *
 * @example
 * ```ts
 * // nvidia.models[0]
 * {
 *   name: 'nvidia/llama-3.2-nv-rerankqa-1b-v2',
 *   isDefault: true,
 *   url: 'https://...',
 *   properties: null,
 *   apiModelSupport: {
 *     status: 'SUPPORTED',
 *   },
 * }
 * ```
 *
 * @field name - The name of the model to use
 * @field isDefault - Whether this model is the default for the provider
 * @field url - The URL endpoint for the reranking model
 * @field properties - Additional properties for the model (may be null)
 * @field apiModelSupport - Information about the model's API support status
 *
 * @see RerankingProviderInfo
 *
 * @public
 */
export interface RerankingProviderModelInfo {
  /**
   * The name of the model to use.
   *
   * @example
   * ```ts
   * // nvidia.models[0].name
   * 'nvidia/llama-3.2-nv-rerankqa-1b-v2'
   * ```
   */
  name: string,
  /**
   * Whether this model is the default for the provider.
   *
   * @example
   * ```ts
   * // nvidia.models[0].isDefault
   * true
   * ```
   */
  isDefault: boolean,
  /**
   * The URL endpoint for the reranking model.
   *
   * @example
   * ```ts
   * // nvidia.models[0].url
   * 'https://...'
   * ```
   */
  url: string,
  /**
   * Additional properties for the model (may be null).
   *
   * @example
   * ```ts
   * // nvidia.models[0].properties
   * null
   * ```
   */
  properties: Record<string, unknown> | null,
  /**
   * Information about the model's API support status.
   *
   * @example
   * ```ts
   * // nvidia.models[0].apiModelSupport
   * { status: 'SUPPORTED' }
   * ```
   */
  apiModelSupport: RerankingProviderModelApiSupportInfo,
  /**
   * Additional parameters for the model, if any.
   */
  parameters?: Record<string, unknown>,
}

/**
 * Information about the model's API support status and lifecycle.
 *
 * @field status - The current lifecycle status of the model
 *
 * @see RerankingProviderModelInfo
 *
 * @public
 */
export interface RerankingProviderModelApiSupportInfo {
  /**
   * The current lifecycle status of the model.
   *
   * @example
   * ```ts
   * // nvidia.models[0].apiModelSupport.status
   * 'SUPPORTED'
   * ```
   */
  status: ModelLifecycleStatus,
}
