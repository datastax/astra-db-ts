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

import type TypedEmitter from 'typed-emitter';
import type {
  AdminOptions,
  CustomHttpClientOptions,
  DataAPIClientOptions,
  DbOptions,
  DefaultHttpClientOptions,
} from '@/src/client/types';
import { LIB_NAME } from '@/src/version';
import type { InternalRootClientOpts } from '@/src/client/types/internal';
import { type DataAPIClientEventMap, type Fetcher, FetchH2, FetchNative, type nullish, TokenProvider } from '@/src/lib';
import { Db, InvalidEnvironmentError } from '@/src/db';
import { AstraAdmin } from '@/src/administration';
import type { FetchCtx } from '@/src/lib/api/fetch/types';
import { isNullish } from '@/src/lib/utils';
import { p, type Parser } from '@/src/lib/validation';
import { parseEnvironment } from '@/src/client/parsers/environment';
import { parseHttpOpts } from '@/src/client/parsers/http-opts';
import { $CustomInspect } from '@/src/lib/constants';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler';
import { CallerCfgHandler } from '@/src/client/opts-handlers/caller-cfg-handler';

/**
 * The base class for the {@link DataAPIClient} event emitter to make it properly typed.
 *
 * Should never need to be used directly.
 *
 * @public
 */
export const DataAPIClientEventEmitterBase = (() => {
  /* istanbul ignore next: exceptional case that can't be manually reproduced */
  try {
    return (require('events') as { EventEmitter: (new () => TypedEmitter<DataAPIClientEventMap>) }).EventEmitter;
  } catch (_) {
    throw new Error(`\`${LIB_NAME}\` requires the \`events\` module to be available for usage. Please provide a polyfill (e.g. the \`events\` package) or use a compatible environment.`);
  }
})();

/**
 * ##### Overview
 *
 * The main entrypoint into working with the Data API. It sits at the top of the
 * [conceptual hierarchy](https://github.com/datastax/astra-db-ts/tree/signature-cleanup?tab=readme-ov-file#abstraction-diagram)
 * of the SDK.
 *
 * The client may take in a default token, which can be overridden by a stronger/weaker token when spawning a new
 * {@link Db} or {@link AstraAdmin} instance.
 *
 * It also takes in a set of default options (see {@link DataAPIClientOptions}) that may also generally be overridden as necessary.
 *
 * **Depending on the Data API backend used, you may need to set the environment option to "dse", "hcd", etc.** See
 * {@link DataAPIEnvironment} for all possible backends. It defaults to "astra".
 *
 * @example
 * ```typescript
 * // Client with default token
 * const client1 = new DataAPIClient('AstraCS:...');
 *
 * // Client with no default token; must provide token in .db() or .admin()
 * const client2 = new DataAPIClient();
 *
 * // Client connecting to a local DSE instance
 * const dseToken = new UsernamePasswordTokenProvider('username', 'password');
 * const client3 = new DataAPIClient(dseToken, { environment: 'dse' });
 *
 * const db1 = client1.db('https://<db_id>-<region>.apps.astra.datastax.com');
 * const db2 = client1.db('<db_id>', '<region>');
 *
 * const coll = await db1.collections('my-collections');
 *
 * const admin1 = client1.admin();
 * const admin2 = client1.admin({ adminToken: '<stronger_token>' });
 *
 * console.log(await coll.insertOne({ name: 'John Joe' }));
 * console.log(await admin1.listDatabases());
 * ```
 *
 * @public
 *
 * @see DataAPIEnvironment
 */
export class DataAPIClient extends DataAPIClientEventEmitterBase {
  readonly #options: InternalRootClientOpts;

  /**
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
   * const db1 = client.db('<db_id>', '<region>', { token: 'AstraCS:...' });
   *
   * // Will throw error as no token is ever provided
   * const db2 = client.db('<db_id>', '<region>');
   * ```
   *
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(options?: DataAPIClientOptions | nullish)

  /**
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
   * const db1 = client.db('<db_id>', '<region>', { token: '<weaker_token>' });
   *
   * // OK; will use <default_token>
   * const db2 = client.db('<db_id>', '<region>');
   * ```
   *
   * @param token - The default token to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(token: string | TokenProvider | nullish, options?: DataAPIClientOptions | nullish)

  constructor(tokenOrOptions?: string | TokenProvider | DataAPIClientOptions | null, maybeOptions?: DataAPIClientOptions | null) {
    super();

    const tokenPassed = (typeof tokenOrOptions === 'string' || tokenOrOptions instanceof TokenProvider || arguments.length > 1);

    const token = (tokenPassed)
      ? tokenOrOptions as string | TokenProvider | nullish
      : undefined;

    const rawOptions = (tokenPassed)
      ? maybeOptions
      : tokenOrOptions;

    const options = parseClientOpts(rawOptions, 'options');

    const dbOptions = DbOptsHandler.parse(options?.dbOptions);
    const adminOptions = AdminOptsHandler.parse(options?.adminOptions);

    const tokens = {
      default: TokenProvider.opts.parse(token, 'token'),
      db: TokenProvider.opts.parseWithin<'token'>(options?.dbOptions, 'options.dbOptions.token'),
      admin: TokenProvider.opts.parseWithin<'adminToken'>(options?.adminOptions, 'options.adminOptions.adminToken'),
    };

    this.#options = {
      environment: options?.environment ?? 'astra',
      fetchCtx: buildFetchCtx(options || undefined),
      dbOptions: DbOptsHandler.concatParse([dbOptions], {
        token: TokenProvider.opts.concat(tokens.default, tokens.db),
        timeoutDefaults: options?.timeoutDefaults,
        logging: options?.logging,
      }),
      adminOptions: AdminOptsHandler.concatParse([adminOptions], {
        adminToken: TokenProvider.opts.concat(tokens.default, tokens.admin),
        timeoutDefaults: options?.timeoutDefaults,
        logging: options?.logging,
      }),
      emitter: this,
      caller: CallerCfgHandler.parseWithin(options, 'caller'),
    };

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIClient(env="${this.#options.environment}")`,
    });
  }

  /**
   * Spawns a new {@link Db} instance using a direct endpoint and given options.
   *
   * **NB. This method does not validate the existence of the database—it simply creates a reference.**
   *
   * This endpoint should include the protocol and the hostname, but not the path. It's typically in the form of
   * `https://<db_id>-<region>.apps.astra.datastax.com`, but it can be used with DSE or any other Data-API-compatible
   * endpoint.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   keyspace: 'my-keyspace',
   *   useHttp2: false,
   * });
   *
   * const db3 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   token: 'AstraCS:...'
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
    return new Db(this.#options, endpoint, DbOptsHandler.parse(options));
  }

  /**
   * Spawns a new {@link AstraAdmin} instance using the given options to work with the DevOps API (for admin
   * work such as creating/managing databases).
   *
   * **NB. This method is only available for Astra databases.**
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
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
   * Closes the client and disconnects all underlying connections. This should be called when the client is no longer
   * needed to free up resources.
   *
   * The client will be no longer usable after this method is called.
   *
   * @remarks
   * This method is idempotent and can be called multiple times without issue.
   *
   * --
   *
   * For most users, this method isn't necessary to call, as resources will be freed up when the
   * server is shut down or the process is killed. However, it's useful in long-running processes or when you want to
   * free up resources immediately.
   *
   * --
   *
   * Think of it as using malloc or using a file descriptor. Freeing them isn't always strictly necessary for
   * long-running usages, but it's there for when you need it.
   *
   * @returns A promise that resolves when the client has been closed.
   */
  public async close(): Promise<void> {
    await this.#options.fetchCtx.ctx.close?.();
    this.#options.fetchCtx.closed.ref = true;
  }
}

const buildFetchCtx = (options: DataAPIClientOptions | undefined): FetchCtx => {
  const clientType = options?.httpOptions?.client;

  const ctx =
    (clientType === 'fetch')
      ? new FetchNative() :
    (clientType === 'custom')
      ? (options!.httpOptions as CustomHttpClientOptions).fetcher
      : tryLoadFetchH2(clientType, options);

  return {
    ctx: ctx,
    closed: { ref: false },
  };
};

const tryLoadFetchH2 = (clientType: 'fetch-h2' | nullish, options: DataAPIClientOptions | undefined): Fetcher => {
  try {
    const httpOptions = options?.httpOptions as DefaultHttpClientOptions | undefined;
    const preferHttp2 = httpOptions?.preferHttp2 ?? true;
    return new FetchH2(httpOptions, preferHttp2);
  } catch (e) {
    if (isNullish(clientType)) {
      return new FetchNative();
    } else {
      throw e;
    }
  }
};

const parseClientOpts: Parser<DataAPIClientOptions | nullish> = (raw, field) => {
  const opts = p.parse('object?')<DataAPIClientOptions>(raw, field);

  if (!opts) {
    return undefined;
  }

  return {
    logging: opts.logging,
    environment: parseEnvironment(opts.environment, `${field}.environment`),
    dbOptions: opts.dbOptions,
    adminOptions: opts.adminOptions,
    caller: opts.caller,
    httpOptions: parseHttpOpts(opts.httpOptions, `${field}.httpOptions`),
    timeoutDefaults: opts.timeoutDefaults,
  };
};
