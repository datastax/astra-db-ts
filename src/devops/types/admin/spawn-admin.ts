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

/**
 * The options available spawning a new {@link AstraAdmin} instance.
 *
 * **Note that this is only available when using Astra as the underlying database.**
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface AdminSpawnOptions {
  /**
   * Whether to monitor commands for {@link AstraAdmin}-level & {@link DbAdmin}-level events through an event emitter.
   *
   * Defaults to `false` if never provided. However, if it was provided when creating the {@link DataAPIClient}, it will
   * default to that value instead.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('*TOKEN*', {
   *   devopsOptions: {
   *     monitorCommands: true,
   *   },
   * });
   *
   * client.on('adminCommandStarted', (e) => {
   *   console.log(`Running command ${e.method} ${e.path}`);
   * });
   *
   * client.on('adminCommandPolling', (e) => {
   *   console.log(`Command ${e.method} ${e.path} running for ${e.elapsed}ms`);
   * });
   *
   * client.on('adminCommandSucceeded', (e) => {
   *   console.log(`Command ${e.method} ${e.path} took ${e.duration}ms`);
   * });
   *
   * client.on('adminCommandFailed', (e) => {
   *   console.error(`Command ${e.method} ${e.path} failed w/ error ${e.error}`);
   * });
   *
   * const admin = client.admin();
   *
   * // Logs:
   * // - Running command POST /databases
   * // - Command POST /databases running for <time>ms [x10]
   * // - Command POST /databases succeeded in <time>ms
   * await admin.createDatabase({ ... });
   * ```
   *
   * @defaultValue false
   *
   * @see AdminCommandEvents
   */
  monitorCommands?: boolean,
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
  adminToken?: string,
  /**
   * The base URL for the devops API, which is typically always going to be the following:
   * ```
   * https://api.astra.datastax.com/v2
   * ```
   */
  endpointUrl?: string,
}