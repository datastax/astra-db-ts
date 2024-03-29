import { Db, mkDb } from '@/src/data-api/db';
import { AstraAdmin, mkAdmin } from '@/src/devops/astra-admin';
import { AdminSpawnOptions, DbSpawnOptions, RootClientOptions, RootClientOptsWithToken } from '@/src/client/types';
import { setLevel } from '@/src/logger';

/**
 * The main entrypoint into working with the Data API. It sits at the top of the
 * [conceptual hierarchy](https://github.com/datastax/astra-db-ts/tree/signature-cleanup?tab=readme-ov-file#abstraction-diagram)
 * of the SDK.
 *
 * The client takes in a default token, which can be overridden by a stronger/weaker token when spawning a new
 * {@link Db} or {@link AstraAdmin} instance.
 *
 * It also takes in a set of default options (see {@link RootClientOptions}) that may also be overridden as necessary.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('AstraCS:...');
 *
 * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 * const db2 = client.db('my-database', 'us-east1');
 *
 * const coll = await db1.collection('my-collection');
 *
 * const admin1 = client.admin();
 * const admin2 = client.admin({ adminToken: '<stronger_token>' });
 *
 * console.log(await coll.insertOne({ name: 'Lordi' }));
 * console.log(await admin1.listDatabases());
 * ```
 */
export class DataApiClient {
  readonly #options: RootClientOptsWithToken;

  /**
   * Constructs a new instance of the {@link DataApiClient}.
   *
   * @param token - The default token to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(token: string, options?: RootClientOptions) {
    this.#options = {
      ...options,
      dbOptions: {
        token: token,
        ...options?.dbOptions,
      },
      adminOptions: {
        adminToken: token,
        ...options?.adminOptions,
      },
    };

    if (options?.logLevel) {
      setLevel(options.logLevel);
    }
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
   * The given options will override any default options set when creating the {@link DataApiClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   namespace: 'my-namespace',
   *   useHttp2: false,
   * });
   * ```
   *
   * @remarks
   * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
   * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
   * instead.
   *
   * @param endpoint - The direct endpoint to use.
   * @param options - Any options to override the default options set when creating the {@link DataApiClient}.
   *
   * @returns A new {@link Db} instance.
   */
  db(endpoint: string, options?: DbSpawnOptions): Db;

  /**
   * Spawns a new {@link Db} instance using a direct endpoint and given options.
   *
   * **NB. This method does not validate the existence of the database—it simply creates a reference.**
   *
   * This overload is purely for user convenience, but it **only supports using Astra as the underlying database**. For
   * DSE or any other Data-API-compatible endpoint, use the other overload instead.
   *
   * The given options will override any default options set when creating the {@link DataApiClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const db1 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1');
   *
   * const db2 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1', {
   *   namespace: 'my-namespace',
   *   useHttp2: false,
   * });
   * ```
   *
   * @remarks
   * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
   * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
   * instead.
   *
   * @param id - The database ID to use.
   * @param region - The region to use.
   * @param options - Any options to override the default options set when creating the {@link DataApiClient}.
   *
   * @returns A new {@link Db} instance.
   */
  db(id: string, region: string, options?: DbSpawnOptions): Db;

  db(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): Db {
    return mkDb(this.#options, endpointOrId, regionOrOptions, maybeOptions);
  }

  /**
   * Spawns a new {@link AstraAdmin} instance using the given options to work with the DevOps API (for admin
   * work such as creating/managing databases).
   *
   * **NB. This method is only available for Astra databases.**
   *
   * The given options will override any default options set when creating the {@link DataApiClient} through
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
   * @param options - Any options to override the default options set when creating the {@link DataApiClient}.
   *
   * @returns A new {@link AstraAdmin} instance.
   */
  admin(options?: AdminSpawnOptions): AstraAdmin {
    return mkAdmin(this.#options, options);
  }
}
