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

import type { LoggingConfig, TimeoutDescriptor, TokenProvider } from '@/src/lib/index.js';
import type { AdditionalHeaders } from '@/src/lib/headers-providers/index.js';

/**
 * The default admin options as can be specified in the {@link DataAPIClientOptions}.
 *
 * See {@link AdminOptions} for more information on the available options.
 *
 * @public
 */
export type RootAdminOptions = Omit<AdminOptions, 'logging' | 'timeoutDefaults'>;

/**
 * The options available spawning a new {@link AstraAdmin} instance.
 *
 * **Note that this is only available when using Astra as the underlying database.**
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface AdminOptions {
  /**
   * The configuration for logging events emitted by the {@link DataAPIClient}.
   *
   * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
   *
   * See {@link LoggingConfig} for *much* more information on configuration, outputs, and inheritance.
   */
  logging?: LoggingConfig,
  /**
   * The access token for the DevOps API, typically of the format `'AstraCS:...'`.
   *
   * If never provided, this will default to the token provided when creating the {@link DataAPIClient}.
   *
   * May be useful for if you want to use a stronger token for the DevOps API than the Data API.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('weak-token');
   *
   * // Using 'weak-token' as the token
   * const db = client.db();
   *
   * // Using 'strong-token' instead of 'weak-token'
   * const admin = client.admin({ adminToken: 'strong-token' });
   * ```
   */
  adminToken?: string | TokenProvider | null,
  /**
   * The base URL for the devops API, which is typically always going to be the following:
   * ```
   * https://api.astra.datastax.com/v2
   * ```
   */
  endpointUrl?: string,
  /**
   * ##### Overview
   *
   * Additional headers to include in the HTTP requests to both the administration API.
   * - This may be either the Data API or the DevOps API depending on the target database, and the operation being performed
   *
   * ##### Disclaimer
   *
   * This is an "escape hatch" of sorts, for setting arbitrary headers which are not covered by other options.
   *
   * In the vast majority of cases, you may want to use other alternatives instead for setting appropriate headers, such
   * as parameters which accept {@link TokenProvider}s
   *
   * ##### Inheritance
   *
   * This will inherit, and may potentially overwrite, any headers set in the {@link DataAPIClient.additionalHeaders} option.
   */
  additionalHeaders?: AdditionalHeaders,
  /**
   * The Astra environment to use when interacting with the DevOps API.
   *
   * In the case of {@link AstraDbAdmin}, if a database endpoint is provided, and its environment does NOT match
   * this value (if it is set), it will throw an error.
   *
   * In the case of {@link DataAPIDbAdmin}, it will simply ignore this value.
   */
  astraEnv?: 'dev' | 'prod' | 'test',
  /**
   * ##### Overview
   *
   * The default timeout options for any operation on this admin instance.
   *
   * See {@link TimeoutDescriptor} for much more information about timeouts.
   *
   * @example
   * ```ts
   * // The request timeout for all operations is set to 1000ms.
   * const client = new DataAPIClient('...', {
   *   timeoutDefaults: { requestTimeoutMs: 1000 },
   * });
   *
   * // The request timeout for all operations borne from this Db is set to 2000ms.
   * const db = client.db('...', {
   *   timeoutDefaults: { requestTimeoutMs: 2000 },
   * });
   * ```
   *
   * ##### Inheritance
   *
   * The timeout options are inherited by all child classes, and can be overridden at any level, including the individual method level.
   *
   * Individual-method-level overrides can vary in behavior depending on the method; again, see {@link TimeoutDescriptor}.
   *
   * ##### Defaults
   *
   * The default timeout options are as follows:
   * - `requestTimeoutMs`: 10000
   * - `generalMethodTimeoutMs`: 30000
   * - `collectionAdminTimeoutMs`: 60000
   * - `tableAdminTimeoutMs`: 30000
   * - `databaseAdminTimeoutMs`: 600000
   * - `keyspaceAdminTimeoutMs`: 30000
   *
   * @see TimeoutDescriptor
   */
  timeoutDefaults?: Partial<TimeoutDescriptor>,
}
