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

import type { DataAPIEnvironment, DataAPILoggingConfig } from '@/src/lib';
import type { Caller, DataAPIHttpOptions, DefaultAdminSpawnOptions, DefaultDbSpawnOptions } from '@/src/client';
import { OneOrMany } from '@/src/lib/types';

/**
 * The default options for the {@link DataAPIClient}. The Data API & DevOps specific options may be overridden
 * when spawning a new instance of their respective classes.
 *
 * @public
 */
export interface DataAPIClientOptions {
  /**
   * The configuration for logging events emitted by the {@link DataAPIClient}.
   *
   * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
   *
   * See {@link DataAPILoggingConfig} for *much* more information on configuration, outputs, and inheritance.
   *
   * **TL;DR: Set `logging: 'all'` for a sane default.**
   */
  logging?: DataAPILoggingConfig,
  /**
   * Sets the Data API "backend" that is being used (e.g. 'dse', 'hcd', 'cassandra', or 'other'). Defaults to 'astra'.
   *
   * Generally, the majority of operations stay the same between backends. However, authentication may differ, and
   * availability of admin operations does as well.
   *
   * - With Astra databases, you'll use an `'AstraCS:...'` token; for other backends, you'll generally want to use the
   *   {@link UsernamePasswordTokenProvider}, or, rarely, even create your own.
   *
   * - {@link AstraAdmin} is only available on Astra databases. {@link AstraDbAdmin} is also only available on Astra
   *   databases, but the {@link DataAPIDbAdmin} alternative is used for all other backends, albeit the expense of a
   *   couple extra features.
   *
   * - Some functions/properties may also not be available on non-Astra backends, such as {@link Db.id} or {@link Db.info}.
   *
   * @remarks
   * No error will be thrown if this is set incorrectly, but bugs may appear in your code, with some operations just
   * throwing errors and refusing to work properly.
   *
   * @defaultValue "astra"
   */
  environment?: DataAPIEnvironment,
  /**
   * The client-wide options related to http operations.
   *
   * There are four different behaviours for setting the client:
   * - Not setting the `httpOptions` at all
   * -- This will attempt to use `fetch-h2` if available, and fall back to `fetch` if not available
   * - `client: 'default'` or `client: undefined` (or unset)
   * -- This will attempt to use `fetch-h2` if available, and throw an error if not available
   * - `client: 'fetch'`
   * -- This will always use the native `fetch` API
   * - `client: 'custom'`
   * -- This will allow you to pass a custom `Fetcher` implementation to the client
   *
   * `fetch-h2` is a fetch implementation that supports HTTP/2, and is the recommended client for the best performance.
   *
   * However, it's generally only available by default on node runtimes; in other environments, you may need to use the
   * native `fetch` API instead, or pass in the fetch-h2 module manually.
   *
   * See the `astra-db-ts` README for more information on different clients.
   *
   * https://github.com/datastax/astra-db-ts
   */
  httpOptions?: DataAPIHttpOptions,
  /**
   * The default options when spawning a {@link Db} instance.
   */
  dbOptions?: DefaultDbSpawnOptions,
  /**
   * The default options when spawning an {@link AstraAdmin} instance.
   */
  adminOptions?: DefaultAdminSpawnOptions,
  /**
   * The caller information to send with requests, of the form `[name, version?]`, or an array of such.
   *
   * **Intended generally for integrations or frameworks that wrap the client.**
   *
   * The caller information is used to identify the client making requests to the server.
   *
   * It will be sent in the headers of the request as such:
   * ```
   * User-Agent: ...<name>/<version> astra-db-ts/<version>
   * ```
   *
   * If no caller information is provided, the client will simply be identified as `astra-db-ts/<version>`.
   *
   * **NB. If providing an array of callers, they should be ordered from most important to least important.**
   * @example
   * ```typescript
   * // 'my-app/1.0.0 astra-db-ts/1.0.0'
   * const client1 = new DataAPIClient('AstraCS:...', {
   *   caller: ['my-app', '1.0.0'],
   * });
   *
   * // 'my-app/1.0.0 my-other-app astra-db-ts/1.0.0'
   * const client2 = new DataAPIClient('AstraCS:...', {
   *   caller: [['my-app', '1.0.0'], ['my-other-app']],
   * });
   * ```
   */
  caller?: OneOrMany<Caller>,
}
