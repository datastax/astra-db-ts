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
// noinspection JSDeprecatedSymbols

import type { AdminOptions, DataAPIClientOptions, DbOptions } from '@/src/client/types/index.js';
import { TokenProvider } from '@/src/lib/index.js';
import { type DataAPIClientEventMap } from '@/src/lib/index.js';
import { Db, InvalidEnvironmentError } from '@/src/db/index.js';
import { AstraAdmin } from '@/src/administration/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler.js';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler.js';
import type { ParsedRootClientOpts } from '@/src/client/opts-handlers/root-opts-handler.js';
import { RootOptsHandler } from '@/src/client/opts-handlers/root-opts-handler.js';
import { HierarchicalLogger } from '@/src/lib/logging/hierarchical-logger.js';
import { InternalLogger } from '@/src/lib/logging/internal-logger.js';

/**
 * ##### Overview
 *
 * The main entrypoint into working with the Data API. It sits at the top of the
 * [conceptual hierarchy](https://github.com/datastax/astra-db-ts/tree/b2b79c15a388d2373e884e8921530d81f3593431?tab=readme-ov-file#high-level-architecture)
 * of the SDK.
 *
 * The client may take in a default token, which can be overridden by a stronger/weaker token when spawning a new
 * {@link Db} or {@link AstraAdmin} instance.
 *
 * It also takes in a set of default options (see {@link DataAPIClientOptions}) that may also generally be overridden in lower classes.
 *
 * @example
 * ```typescript
 * // Client with default token
 * const client = new DataAPIClient('<token>');
 * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 *
 * // Client with no default token; must provide token in .db() or .admin()
 * const client = new DataAPIClient();
 * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com', { token });
 *
 * const coll = await db.collection('my_collection');
 *
 * const admin1 = client.admin();
 * const admin2 = client.admin({ adminToken: '<stronger_token>' });
 *
 * console.log(await coll.insertOne({ name: 'John Joe' }));
 * console.log(await admin1.listDatabases());
 * ```
 *
 * ---
 *
 * ##### The options hierarchy
 *
 * Like the class hierarchy aforementioned, the options for each class also form an [adjacent hierarchy](https://github.com/datastax/astra-db-ts/tree/b2b79c15a388d2373e884e8921530d81f3593431?tab=readme-ov-file#options-hierarchy).
 *
 * The options for any class are a deep merge of the options for the class itself and the options for its parent classes.
 *
 * For example, you may set default {@link CollectionOptions.logging} options in {@link DataAPIClientOptions.logging}, and override them in the {@link CollectionOptions} themselves as desired.
 *
 * @example
 * ```ts
 * const client = new DataAPIClient({
 *   logging: [{ events: 'all', emits: 'event' }],
 * });
 * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com', { token });
 *
 * // Everything will still be emitted as an event,
 * // But now, `commandFailed` events from this collection will also log to stderr
 * const coll = db.collection('<name>', {
 *   logging: [{ events: 'commandFailed', emits: ['event', 'stderr'] }],
 * });
 * ```
 *
 * ---
 *
 * ##### Non-Astra support (DSE, HCD, etc.)
 *
 * Depending on the Data API backend used, you may need to set the environment option in certain places to "dse", "hcd", etc.
 *
 * See {@link DataAPIEnvironment} for all possible backends; it defaults to "astra" if not specified.
 *
 * Currently, if you're not using Astra, you need to specify the environment when:
 * - Creating the {@link DataAPIClient}
 * - Using {@link Db.admin}
 *
 * @example
 * ```ts
 * // Client connecting to a local DSE instance
 * const dseToken = new UsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(dseToken, { environment: 'dse' });
 * ```
 *
 * @public
 *
 * @see DataAPIEnvironment
 * @see DataAPIClientOptions
 */
export class DataAPIClient extends HierarchicalLogger<DataAPIClientEventMap> {
  readonly #options: ParsedRootClientOpts;

  /**
   * ##### Overview
   *
   * Constructs a new instance of the {@link DataAPIClient} without a default token. The token will instead need to
   * be specified when calling `.db()` or `.admin()`.
   *
   * Prefer this method when using a db-scoped token instead of a more universal token.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient();
   *
   * // OK
   * const db1 = client.db('<endpoint>', { token: '<token>' });
   *
   * // Will throw error as no token is ever provided
   * const db2 = client.db('<endpoint>');
   * ```
   *
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(options?: DataAPIClientOptions)

  /**
   * ##### Overview
   *
   * Constructs a new instance of the {@link DataAPIClient} with a default token. This token will be used everywhere
   * if no overriding token is provided in `.db()` or `.admin()`.
   *
   * Prefer this method when using a universal/admin-scoped token.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('<default_token>');
   *
   * // OK
   * const db1 = client.db('<endpoint>', { token: '<weaker_token>' });
   *
   * // OK; will use <default_token>
   * const db2 = client.db('<endpoint>');
   * ```
   *
   * @param token - The default token to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(token: string | TokenProvider | undefined, options?: DataAPIClientOptions)

  constructor(tokenOrOptions?: string | TokenProvider | DataAPIClientOptions, maybeOptions?: DataAPIClientOptions) {
    const tokenPassed = (typeof tokenOrOptions === 'string' || tokenOrOptions instanceof TokenProvider || arguments.length > 1);

    const token = (tokenPassed)
      ? tokenOrOptions as string | TokenProvider | undefined
      : undefined;

    const rawOptions = (tokenPassed)
      ? maybeOptions
      : tokenOrOptions;

    const loggingConfig = InternalLogger.cfg.parse(rawOptions?.logging);
    super(null, loggingConfig);

    const parsedToken = TokenProvider.opts.parse(token, 'token');
    this.#options = RootOptsHandler(parsedToken, this).parse(rawOptions ?? {}, 'options');

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIClient(env="${this.#options.environment}")`,
    });
  }

  /**
   * ##### Overview
   *
   * Spawns a new {@link Db} instance using a direct endpoint and given options.
   *
   * ---
   *
   * ##### Disclaimer
   *
   * This method does *not* validate the existence of the database—it simply creates a reference.**
   *
   * Note that this does not perform any I/O or validation on if the endpoint is valid or not. It's up to the user to
   * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
   * instead.
   *
   * ---
   *
   * ##### The API endpoint
   *
   * This endpoint should include the protocol and the hostname, but not the path.
   *
   * If you're using Astra, this will typically be of the form `https://<db_id>-<region>.apps.astra.datastax.com` (the exception being private endpoints); any other database may have a completely unique domain.
   *
   * Spawning a db via just an ID and region is no longer supported in `astra-db-ts 2.0+`. Use the {@link buildAstraEndpoint} to create the endpoint if you need to.
   *
   * @example
   * ```ts
   * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   * ```
   *
   * ---
   *
   * ##### The options hierarchy
   *
   * The options for the {@link Db} instance are a deep merge of the options for the {@link DataAPIClient} and the options for the {@link Db} itself.
   *
   * Any options provided to {@link DbOptions} may generally also be overridden in any spawned classes' options (e.g. {@link CollectionOptions}).
   *
   * @example
   * ```typescript
   * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   keyspace: 'my_keyspace',
   *   token: 'AstraCS:...',
   * });
   *
   * const coll = db.collection('my_coll', {
   *   keyspace: 'other_keyspace',
   * });
   * ```
   *
   * @remarks
   * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
   * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
   * instead.
   *
   * @param endpoint - The direct endpoint to use.
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link Db} instance.
   */
  public db(endpoint: string, options?: DbOptions): Db {
    if (typeof options as unknown === 'string') {
      throw new Error(`.db() no longer allows the .db('<id>', '<region>') overload; please pass in the full endpoint url (e.g. .db('<endpoint>')). You may use the exported \`buildAstraEndpoint\` utility function if you need to create an endpoint from just an ID and a region.`);
    }
    return new Db(this.#options, endpoint, DbOptsHandler.parse(options));
  }

  /**
   * ##### Overview (Astra-only)
   *
   * Spawns a new {@link AstraAdmin} instance using the given options to work with the DevOps API (for admin
   * work such as creating/managing databases).
   *
   * **Note: this method is only available for Astra databases.**
   *
   * @example
   * ```typescript
   * const admin1 = client.admin();
   * const admin2 = client.admin({ adminToken: '<stronger_token>' });
   *
   * const dbs = await admin1.listDatabases();
   * console.log(dbs);
   * ```
   *
   * ---
   *
   * ##### The options hierarchy
   *
   * The options for the {@link AstraAdmin} instance are a deep merge of the options for the {@link DataAPIClient} and the options for the {@link AstraAdmin} itself.
   *
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraAdmin} instance.
   */
  public admin(options?: AdminOptions): AstraAdmin {
    if (this.#options.environment !== 'astra') {
      throw new InvalidEnvironmentError('admin', this.#options.environment, ['astra'], 'AstraAdmin is only available for Astra databases');
    }
    return new AstraAdmin(this.#options, AdminOptsHandler.parse(options, 'options'));
  }

  /**
   * ##### Overview
   *
   * Closes the client and disconnects all underlying connections. This should be called when the client is no longer
   * needed to free up resources.
   *
   * The client will be no longer usable after this method is called.
   *
   * This method is idempotent and can be called multiple times without issue.
   *
   * @example
   * ```ts
   * const client = new DataAPIClient(...);
   * await client.close();
   *
   * // Error: Can't make requests on a closed client
   * const coll = client.db(...).collection(...);
   * await coll.findOne();
   * ```
   * ---
   *
   * ##### When to call this method
   *
   * For most users, this method isn't necessary to call, as resources will be freed up when the
   * server is shut down or the process is killed.
   *
   * However, it's useful in long-running processes or when you want to free up resources immediately.
   *
   * Think of it as using malloc or using a file descriptor. Freeing them isn't *strictly* necessary when they're used for the duration of the program, but it's there for when you need it.
   *
   * @returns A promise that resolves when the client has been closed.
   */
  public async close(): Promise<void> {
    await this.#options.fetchCtx.ctx.close?.();
    this.#options.fetchCtx.closed.ref = true;
  }
}
