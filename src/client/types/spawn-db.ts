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

import { DataAPILoggingConfig, type TimeoutDescriptor, TokenProvider } from '@/src/lib';
import { CollectionSerDesConfig, SomeDoc, SomeRow, TableSerDesConfig } from '@/src/documents';

export type RootDbOptions = Omit<DbOptions, 'logging' | 'timeoutDefaults'>;

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface DbOptions {
  /**
   * The configuration for logging events emitted by the {@link DataAPIClient}.
   *
   * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
   *
   * See {@link DataAPILoggingConfig} for *much* more information on configuration, outputs, and inheritance.
   */
  logging?: DataAPILoggingConfig,
  /**
   * The keyspace to use for the database.
   *
   * There are a few rules for what the default keyspace will be:
   * 1. If a keyspace was provided when creating the {@link DataAPIClient}, it will default to that value.
   * 2. If using an `astra` database, it'll default to "default_keyspace".
   * 3. Otherwise, no default will be set, and it'll be on the user to provide one when necessary.
   *
   * The client itself will not throw an error if an invalid keyspace (or even no keyspace at all) is provided—it'll
   * let the Data API propagate the error itself.
   *
   * Every db method will use this keyspace as the default keyspace, but they all allow you to override it
   * in their options.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('AstraCS:...');
   *
   * // Using 'default_keyspace' as the keyspace
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * // Using 'my_keyspace' as the keyspace
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   keyspace: 'my_keyspace',
   * });
   *
   * // Finds 'my_collection' in 'default_keyspace'
   * const coll1 = db1.collections('my_collection');
   *
   * // Finds 'my_collection' in 'my_keyspace'
   * const coll2 = db1.collections('my_collection');
   *
   * // Finds 'my_collection' in 'other_keyspace'
   * const coll3 = db1.collections('my_collection', { keyspace: 'other_keyspace' });
   * ```
   *
   * @defaultValue 'default_keyspace'
   */
  keyspace?: string | null,
  /**
   * The access token for the Data API, typically of the format `'AstraCS:...'`.
   *
   * If never provided, this will default to the token provided when creating the {@link DataAPIClient}.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('strong-token');
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
  token?: string | TokenProvider | null,
  /**
   * The path to the Data API, which is going to be `api/json/v1` for all Astra instances. However, it may vary
   * if you're using a different Data API-compatible endpoint.
   *
   * Defaults to `'api/json/v1'` if never provided. However, if it was provided when creating the {@link DataAPIClient},
   * it will default to that value instead.
   *
   * @defaultValue 'api/json/v1'
   */
  dataApiPath?: string,
  serdes?: DbSerDesConfig,
  /**
   * Additional headers to include in the HTTP requests to the DevOps API.
   *
   * @remarks
   * There are more than likely more official/structured ways to set any desired headers, such as through
   * {@link TokenProvider}s or {@link EmbeddingHeadersProvider}s. This is more of a last-resort option, such
   * as for enabling feature-flags or other non-standard headers.
   */
  additionalHeaders?: Record<string, string>,
  /**
   * ##### Overview
   *
   * The default timeout options for anything spawned by this {@link Db} instance.
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

/**
 * ##### Overview
 *
 * The config for common table/collection serialization/deserialization logic.
 *
 * Such custom logic may be used for various purposes, such as:
 * - Integrating your own custom data types
 * - Validating data before it's sent to the database, or after it's received
 * - Adding support for datatypes not yet supported by the client
 *
 * ##### Disclaimer
 *
 * This is an advanced, somewhat backdoor-y feature, and should be used with caution, and heavily tested. Buggy logic could
 * lead to data loss/corruption, or other unexpected behavior.
 *
 * This is also a very `astra-db-ts`-specific feature, and may not be supported by other clients.
 *
 * ##### Table/Collection-specific configuration
 *
 * This object is used for config you'd want to use across all of your spawned tables/collections; if you want to configure
 * `serdes` for a specific {@link Table}/{@link Collection}, you can do so in their respective options objects.
 *
 * See {@link CollectionSerDesConfig} and {@link TableSerDesConfig} for information on how to implement your own ser/des logic.
 *
 * The `serdes` config in each child object is deep-merged with the config of its parent, with the child's config taking precedence.
 *
 * @example
 * ```ts
 * const client = new DataAPIClient('*TOKEN*', {
 *   dbOptions: {
 *     serdes: {
 *       table { serialize() {} }, // serializer1
 *     },
 *   },
 * });
 *
 * const db = client.db('*ENDPOINT*', {
 *   serdes: {
 *     table: { serialize() {} }, // serializer2
 *   },
 * });
 *
 * // table will use all serializers, in this order:
 * // [serializer3, serializer2, serializer1, DefaultSerializer]
 * const table = client.table('*NAME*', {
 *   serdes: {
 *     table: { serialize() {} }, // serializer3
 *   },
 * });
 * ```
 *
 * ##### Example
 *
 * See {@link CollectionSerDesConfig} & {@link TableSerDesConfig} for more examples & much more information, but here's a quick example:
 *
 * @example
 * ```ts
 * import { $SerializeForCollections, ... } from '@datastax/astra-db-ts';
 *
 * // Custom datatype
 * class UserID {
 *   constructor(public readonly unwrap: string) {}
 *   [$SerializeForCollections] = () => this.unwrap; // Serializer checks for this symbol
 * }
 *
 * // Schema type of the collection, using the custom datatype
 * interface User {
 *   _id: UserID,
 *   name: string,
 * }
 *
 * const collection = db.collection<User>('users', {
 *   serdes: { // Serializer not necessary here since `$SerializeForCollections` is used
 *     deserialize(key, value) {
 *       if (key === '_id') return [new UserID(value)]; // [X] specifies a new value
 *     },
 *   },
 * });
 *
 * const inserted = await collection.insertOne({
 *   _id: new UserID('123'), // will be stored in db as '123'
 *   name: 'Alice',
 * });
 *
 * console.log(inserted.insertedId.unwrap); // '123'
 * ```
 *
 * @field table - Default configuration for table serialization/deserialization.
 * @field collection - Default configuration for collection serialization/deserialization.
 * @field mutateInPlace - An optimization for inserted records to be mutated in-place when serializing.
 *
 * @see CollectionSerDesConfig
 * @see TableSerDesConfig
 * @see $SerializeForCollections
 * @see $SerializeForTables
 *
 * @public
 */
export interface DbSerDesConfig {
  table?: Omit<TableSerDesConfig, 'mutateInPlace'>,
  collection?: Omit<CollectionSerDesConfig, 'mutateInPlace'>,
  /**
   * ##### Overview
   *
   * Enables an optimization which allows inserted rows/documents to be mutated in-place when serializing.
   *
   * ##### Context
   *
   * For example, when you insert a record like so:
   * ```ts
   * import { UUID } from '@datastax/astra-db-ts';
   * await collection.insertOne({ name: 'Alice', friends: { john: new UUID('...') } });
   * ```
   *
   * The document is internally serialized as such:
   * ```ts
   * { name: 'Alice', friends: { john: { $uuid: '...' } } }
   * ```
   *
   * To avoid mutating a user-provided object, the client will be forced to clone any objects that contain
   * a custom datatype, as well as their parents (which looks something like this):
   * ```ts
   * { ...original, friends: { ...original.friends, john: { $uuid: '...' } } }
   * ```
   *
   * ##### Enabling this option
   *
   * This can be a minor performance hit, especially for large objects, so if you're confident that you won't be
   * needing the object after it's inserted, you can enable this option to avoid the cloning, and instead mutate
   * the object in-place.
   *
   * @example
   * ```ts
   * // Before
   * const collection = db.collection<User>('users');
   *
   * const doc = { name: 'Alice', friends: { john: UUID.v4() } };
   * await collection.insertOne(doc);
   *
   * console.log(doc); // { name: 'Alice', friends: { john: UUID<4>('...') } }
   *
   * // After
   * const collection = db.collection<User>('users', {
   *   serdes: { mutateInPlace: true },
   * });
   *
   * const doc = { name: 'Alice', friends: { john: UUID.v4() } };
   * await collection.insertOne(doc);
   *
   * console.log(doc); // { name: 'Alice', friends: { john: { $uuid: '...' } } }
   * ```
   *
   * @defaultValue false
   */
  mutateInPlace?: boolean,
}
