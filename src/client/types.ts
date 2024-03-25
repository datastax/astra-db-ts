import { Caller } from '@/src/api';

/**
 * The default options for the {@link DataApiClient}. The Data API & DevOps specific options may be overridden
 * when spawning a new instance of their respective classes.
 */
export interface RootClientOptions {
  /**
   * A winston log level (`'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'`).
   *
   * Defaults to `process.env.NODE_ENV === 'production' ? 'error' : 'info'`.
   *
   * @defaultValue process.env.NODE_ENV === 'production' ? 'error' : 'info'
   */
  logLevel?: string,
  /**
   * The caller information to send with requests, of the form `[name, version?]`, or an array of such.
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
   *
   * @example
   * ```typescript
   * // 'my-app/1.0.0 astra-db-ts/1.0.0'
   * const client1 = new DataApiClient('AstraCS:...', {
   *   caller: ['my-app', '1.0.0'],
   * });
   *
   * // 'my-app/1.0.0 my-other-app astra-db-ts/1.0.0'
   * const client2 = new DataApiClient('AstraCS:...', {
   *   caller: [['my-app', '1.0.0'], ['my-other-app']],
   * });
   * ```
   */
  caller?: Caller | Caller[],
  /**
   * The default options when spawning a {@link Db} instance.
   */
  dataApiOptions?: DbSpawnOptions,
  /**
   * The default options when spawning an {@link AstraAdmin} instance.
   */
  devopsOptions?: AdminSpawnOptions,
}

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataApiClient}.
 */
export interface DbSpawnOptions {
  /**
   * The namespace (aka keyspace) to use for the database.
   *
   * Defaults to `'default_keyspace'`. if never provided. However, if it was provided when creating the
   * {@link DataApiClient}, it will default to that value instead.
   *
   * Every db method will use this namespace as the default namespace, but they all allow you to override it
   * in their options.
   *
   * @example
   * ```typescript
   * const client = new DataApiClient('AstraCS:...');
   *
   * // Using 'default_keyspace' as the namespace
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * // Using 'my_namespace' as the namespace
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   namespace: 'my_keyspace',
   * });
   *
   * // Finds 'my_collection' in 'default_keyspace'
   * const coll1 = db1.collection('my_collection');
   *
   * // Finds 'my_collection' in 'my_namespace'
   * const coll2 = db1.collection('my_collection');
   *
   * // Finds 'my_collection' in 'other_keyspace'
   * const coll3 = db1.collection('my_collection', { namespace: 'other_keyspace' });
   * ```
   *
   * @defaultValue 'default_keyspace'
   */
  namespace?: string,
  /**
   * The access token for the Data API, typically of the format `'AstraCS:...'`.
   *
   * If never provided, this will default to the token provided when creating the {@link DataApiClient}.
   *
   * @example
   * ```typescript
   * const client = new DataApiClient('strong-token');
   *
   * // Using 'strong-token' as the token
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * // Using 'weaker-token' instead of 'strong-token'
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   token: 'weaker-token',
   * });
   * ```
   */
  token?: string,
  /**
   * Whether to use HTTP/2 for requests.
   *
   * Both versions are typically interchangeable, but HTTP2 is generally recommended for better performance. However,
   * some errors may differ between the two versions, due to different underlying implementations.
   *
   * Defaults to `true` if never provided. However, if it was provided when creating the {@link DataApiClient}, it will
   * default to that value instead.
   *
   * @defaultValue true
   */
  useHttp2?: boolean,
  /**
   * Whether to log skipped options (logs as 'warn')
   *
   * Logs when a command is executed with options that are not supported by the client
   *
   * Defaults to `false`.
   *
   * @example
   * ```typescript
   * // Logs a warning 'findOne' does not support option 'unknownOption'
   * await findOne({}, { unknownOption: 'value' });
   * ```
   *
   * @defaultValue false
   */
  logSkippedOptions?: boolean,
  /**
   * The path to the Data API, which is going to be `api/json/v1` for all Astra instances. However, it may vary
   * if you're using a different Data API-compatible endpoint.
   *
   * Defaults to `'api/json/v1'` if never provided. However, if it was provided when creating the {@link DataApiClient},
   * it will default to that value instead.
   *
   * @defaultValue 'api/json/v1'
   */
  dataApiPath?: string,
}

/**
 * The options available spawning a new {@link AstraAdmin} instance.
 *
 * **Note that this is only available when using Astra as the underlying database.**
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataApiClient}.
 */
export interface AdminSpawnOptions {
  /**
   * The access token for the DevOps API, typically of the format `'AstraCS:...'`.
   *
   * If never provided, this will default to the token provided when creating the {@link DataApiClient}.
   *
   * May be useful for if you want to use a stronger token for the DevOps API than the Data API.
   *
   * @example
   * ```typescript
   * const client = new Data('weak-token');
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

/**
 * @internal
 */
export interface RootClientOptsWithToken {
  logLevel?: string,
  caller?: Caller | Caller[],
  dataApiOptions: DbSpawnOptions & { token: string },
  devopsOptions: AdminSpawnOptions & { adminToken: string },
}
