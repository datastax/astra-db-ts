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

import type {
  CommandEventMap,
  CreateTableIndexOptions,
  CreateTableVectorIndexOptions,
  FoundRow,
  SomeDoc,
  SomeRow,
  TableFilter,
  TableFindOneOptions,
  TableFindOptions,
  TableInsertManyOptions,
  TableInsertManyResult,
  TableInsertOneResult,
  TableUpdateFilter,
  WithSim,
} from '@/src/documents/index.js';
import {
  TableInsertManyError,
} from '@/src/documents/index.js';
import type { BigNumberHack, DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client.js';
import { CommandImpls } from '@/src/documents/commands/command-impls.js';
import type {
  AlterTableOptions,
  CreateTableDefinition,
  Db,
  DropTableOptions,
  ListTableDefinition,
  TableOptions,
} from '@/src/db/index.js';
import { HierarchicalEmitter } from '@/src/lib/logging/hierarchical-emitter.js';
import type { OpaqueHttpClient, WithTimeout } from '@/src/lib/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import JBI from 'json-bigint';
import { TableFindCursor } from '@/src/documents/tables/cursor.js';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import type { ListIndexOptions, TableIndexDescriptor } from '@/src/db/types/tables/list-indexes.js';
import { withJbiNullProtoFix } from '@/src/lib/api/ser-des/utils.js';

const jbi = JBI({ storeAsString: true });

/**
 * #### Overview
 *
 * Represents the interface to a table in a Data-API-enabled database.
 *
 * **This shouldn't be directly instantiated, but rather created via {@link Db.createTable} or {@link Db.table}**.
 *
 * @example
 * ```ts
 * // Basic creation of a dynamically typed table
 * // (If you don't provide `SomeRow` explicitly, it will
 * // attempt to infer the Table's type from the definition)
 * const table = await db.createTable<SomeRow>('users', {
 *   definition: {
 *     columns: {
 *       id: 'text',
 *       name: 'text',
 *     },
 *     primaryKey: 'id',
 *   },
 * });
 *
 * // or (also dynamically typed)
 * const table = db.table('users');
 * ```
 *
 * #### Typing & Types
 *
 * **NOTE: For most intents & purposes (unless you're using custom ser/des), you can ignore the (generally negligible) difference between `WSchema` and `RSchema`, and treat `Table` as if it were typed as `Table<Schema, PKey>`**.
 *
 * A `Table` is typed as `Table<WSchema, PKey, RSchema>`, where:
 *  - `WSchema` is the type of the row as it's written to the table (the "write" schema)
 *    - This includes inserts, filters, sorts, etc.
 *  - `PKey` (optional) is the type of the primary key of the table as it's returned
 *  - `RSchema` is the type of the row as it's read from the table (the "read" schema)
 *    - This includes finds
 *    - Unless custom ser/des is used, it is nearly exactly the same as `WSchema`
 *    - It defaults to `FoundRow<WSchema>` (see {@link FoundRow})
 *
 * See {@link FoundRow} for more info about the differences, but again, for most intents & purposes, you can ignore this, and pretend they were
 *
 * ###### Custom datatypes
 *
 * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
 *
 * For example:
 *  - `'map<k, v>'` is represented by a native JS `Map<K, V>`
 *  - `'vector'` is represented by an `astra-db-ts` provided `DataAPIVector`
 *  - `'date'` is represented by an `astra-db-ts` provided `DataAPIDate`
 *
 * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
 *
 * @example
 * ```ts
 * interface User {
 *   id: string,
 *   friends: Map<string, UUID>, // UUID is also `astra-db-ts` provided
 *   vector: DataAPIVector,
 * }
 *
 * await db.table<User>('users').insertOne({
 *   id: '123',
 *   friends: new Map([['Alice', uuid(4)]]), // or UUID.v4()
 *   vector: vector([1, 2, 3]), // or new DataAPIVector([...])
 * });
 * ```
 *
 * ###### Big numbers disclaimer
 *
 * When `varint`s or `decimal`s are present in the schema, and when you're serializing `bigint`s and {@link BigNumber}s, it will automatically enable usage of a bignumber-friendly JSON library which is capable of serializing/deserializing these numbers without loss of precision, but is much slower than the native JSON library (but, realistically, the difference is likely negligible).
 *
 * ###### Typing the key
 *
 * The primary key of the table should be provided as a second type parameter to `Table`.
 *
 * This is a special type that is used to reconstruct the TS type of the primary key in insert operations. It should be an object with the same keys as the primary key columns, and the same types as the schema. Note that there is no distinction between partition and clustering keys in this type.
 *
 * @example
 * ```ts
 * interface User {
 *   id: string,   // Partition key
 *   dob: DataAPIDate, // Clustering (partition sort) key
 *   friends: Map<string, UUID>,
 * }
 *
 * type UserPK = Pick<User, 'id' | 'dob'>;
 *
 * // res.insertedId is of type { id: string }
 * const res = await db.table<User, UserPK>('users').insertOne({
 *   id: '123',
 *   dob: date(), // or new DataAPIDate(new Date())
 *   friends: new Map([['Alice', uuid(4)]]), // or UUID.v4()
 * });
 * ```
 *
 * ###### `db.createTable` type inference
 *
 * When creating a table through {@link Db.createTable}, and not using any custom datatypes (see next session), you can actually use the {@link InferTableSchema} & {@link InferTablePrimaryKey} utility types to infer the schema of the table from the table creation.
 *
 * **You may also see {@link Table.schema} for an alternative method of having an inferred table schema.**
 *
 * @example
 * ```ts
 * // equivalent to:
 * // type User = {
 * //   id: string,
 * //   dob: DataAPIDate,
 * //   friends?: Map<string, UUID>, // Optional since it's not in the primary key
 * // }
 * type User = InferTableSchema<typeof mkTable>;
 *
 * // equivalent to:
 * // type UserPK = Pick<User, 'id' | 'dob'>;
 * type UserPK = InferTablePrimaryKey<typeof mkTable>;
 *
 * const mkUsersTable = () => db.createTable('users', {
 *   definition: {
 *     columns: {
 *       id: 'text',
 *       dob: 'date',
 *       friends: { type: 'map', keyType: 'text', valueType: 'uuid' },
 *     },
 *     primaryKey: {
 *       partitionBy: ['id'],
 *       partitionSort: { dob: -1 }
 *     },
 *   },
 * });
 *
 * async function main() {
 *   const table: Table<User, UserPK> = await mkUsersTable();
 *   // ... use table
 * }
 * ```
 *
 * ###### Custom datatypes
 *
 * You can plug in your own custom datatypes, as well as enable many other features by providing some custom serialization/deserialization logic through the `serdes` option in {@link TableOptions}, {@link DbOptions}, and/or {@link DataAPIClientOptions.dbOptions}.
 *
 * Note however that this is currently not entirely stable, and should be used with caution.
 *
 * See the official DataStax documentation for more info.
 *
 * ###### Disclaimer
 *
 * *It is on the user to ensure that the TS type of the `Table` corresponds with the actual CQL table schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.*
 *
 * See {@link Db.createTable}, {@link Db.table}, and {@link InferTableSchema} for much more information about typing.
 *
 * @see SomeRow
 * @see Db.createTable
 * @see Db.table
 * @see InferTableSchema
 * @see InferTablePrimaryKey
 * @see TableSerDesConfig
 * @see TableOptions
 *
 * @public
 */
export class Table<WSchema extends SomeRow, PKey extends SomeRow = Partial<FoundRow<WSchema>>, RSchema extends SomeRow = FoundRow<WSchema>> extends HierarchicalEmitter<CommandEventMap> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #commands: CommandImpls<PKey>;
  readonly #db: Db;

  /**
   * The name of the table. Unique per keyspace.
   */
  public readonly name!: string;

  /**
   * The keyspace that the table resides in.
   */
  public readonly keyspace!: string;

  /**
   * ##### Overview (TS 5.0+)
   *
   * Strongly types the creation of a `const` new {@link CreateTableDefinition} schema.
   *
   * Unlike writing the table definition inline in `createTable` and using `InferTableSchema` on the `Table` itself, this method:
   *   - Allows you to define your schemas separately, outside an async context
   *   - Provides type errors if any primary keys don't use a valid column
   *
   * Similar to using `const Schema = { ... } as const [satisfies CreateTableDefinition<any>]`.
   *
   * @example
   * ```ts
   * // Define the table schema
   * const UserSchema = Table.schema({
   *   columns: {
   *     name: 'text',
   *     dob: {
   *       type: 'timestamp',
   *     },
   *     friends: {
   *       type: 'set',
   *       valueType: 'text',
   *     },
   *   },
   *   primaryKey: {
   *     partitionBy: ['name', 'height'], // type error: 'height' is not a valid column
   *     partitionSort: { dob: 1 },
   *   },
   * });
   *
   * // Type inference is as simple as that
   * type User = InferTableSchema<typeof UserSchema>;
   *
   * // And now `User` can be used wherever.
   * const main = async () => {
   *   const table = await db.createTable('users', { definition: UserSchema });
   *   const found: User | null = await table.findOne({});
   * };
   * ```
   *
   * ##### Pre-TS 5.0
   *
   * If you're not using TS 5.0+, you'll need to manually do the following.
   *
   * However, this is not recommended whenever possible, as type errors due to invalid schemas will not be properly localized.
   *
   * ```ts
   * const UserSchema = <const>{
   *   columns: { ... },
   *   primaryKey: ...,
   * };
   *
   * type User = InferTableSchema<typeof UserSchema>;
   *
   * const main = async () => {
   *   const table = await db.createTable('users', { definition: UserSchema });
   *   const found: User | null = await table.findOne({});
   * };
   * ```
   *
   * @param schema - The schema to strongly type.
   *
   * @returns The exact same object passed in. This method simply exists for the strong typing.
   */
  public static schema<const Def extends CreateTableDefinition<Def>>(schema: Def): Def {
    return schema;
  }

  /**
   * Use {@link Db.table} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: TableOptions | undefined) {
    super(db);

    Object.defineProperty(this, 'name', {
      value: name,
    });

    Object.defineProperty(this, 'keyspace', {
      value: opts?.keyspace ?? db.keyspace,
    });

    const hack: BigNumberHack = {
      parseWithBigNumbers(json: string) {
        return json.includes('{"type":"varint"}') || json.includes('{"type":"decimal"}');
      },
      parser: withJbiNullProtoFix(jbi),
    };

    this.#httpClient = httpClient.forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(this, opts, hack);
    this.#commands = new CommandImpls(this, this.#httpClient, new TableSerDes(TableSerDes.cfg.parse(opts?.serdes)));
    this.#db = db;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `Table(keyspace="${this.keyspace}",name="${this.name}")`,
    });
  }

  /**
   * ##### Overview
   *
   * Atomically upserts a single row into the table.
   *
   * @example
   * ```ts
   * import { UUID, vector, ... } from '@datastax/astra-db-ts';
   *
   * // Insert a row with a specific ID
   * await table.insertOne({ id: 'text-id', name: 'John Doe' });
   * await table.insertOne({ id: UUID.v7(), name: 'Dane Joe' }); // or uuid(7)
   *
   * // Insert a row with a vector
   * // DataAPIVector class enables faster ser/des
   * const vec = vector([.12, .52, .32]); // or new DataAPIVector([.12, .52, .32])
   * await table.insertOne({ id: 1, name: 'Jane Doe', vector: vec });
   *
   * // or if vectorize (auto-embedding-generation) is enabled for the column
   * await table.insertOne({ id: 1, name: 'Jane Doe', vector: "Hey there!" });
   * ```
   *
   * ##### Upsert behavior
   *
   * When inserting a row with a primary key that already exists, the new row will be merged with the existing row, with the new values taking precedence.
   *
   * If you want to delete old values, you must explicitly set them to `null` (not `undefined`).
   *
   * @example
   * ```ts
   * await table.insertOne({ id: '123', col1: 'I exist' });
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'I exist' }
   *
   * await table.insertOne({ id: '123', col1: 'I am new' });
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'I am new' }
   *
   * await table.insertOne({ id: '123', col2: 'me2' });
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'I am new', col2: 'me2' }
   *
   * await table.insertOne({ id: '123', col1: null });
   * await table.findOne({ id: '123' }); // { id: '123', col2: 'me2' }
   * ```
   *
   * ##### The primary key
   *
   * The type of the primary key of the table is inferred from the second `PKey` type-param of the table.
   *
   * If not present, it defaults to `Partial<RSchema>` to keep the result type consistent.
   *
   * @example
   * ```ts
   * interface User {
   *   id: string,
   *   name: string,
   *   dob?: DataAPIDate,
   * }
   *
   * type UserPKey = Pick<User, 'id'>;
   *
   * const table = db.table<User, UserPKey>('table');
   *
   * // res.insertedId is of type { id: string }
   * const res = await table.insertOne({ id: '123', name: 'Alice' });
   * console.log(res.insertedId.id); // '123'
   * ```
   *
   * @param row - The row to insert.
   * @param timeout - The timeout for this operation.
   *
   * @returns The primary key of the inserted row.
   */
  public async insertOne(row: WSchema, timeout?: WithTimeout<'generalMethodTimeoutMs'>): Promise<TableInsertOneResult<PKey>> {
    return this.#commands.insertOne(row, timeout);
  }

  /**
   * ##### Overview
   *
   * Upserts many rows into the table.
   *
   * @example
   * ```ts
   * import { uuid, vector, ... } from '@datastax/astra-db-ts';
   *
   * await table1.insertMany([
   *   { id: uuid(4), name: 'John Doe' }, // or UUID.v4()
   *   { id: uuid(7), name: 'Jane Doe' },
   * ]);
   *
   * // Insert a row with a vector
   * // DataAPIVector class enables faster ser/des
   * await table2.insertMany([
   *   { name: 'bob', vector: vector([.12, .52, .32]) }, // or new DataAPIVector([...])
   *   { name: 'alice', vector: vector([.12, .52, .32]), tags: new Set(['cool']) },
   * ], { ordered: true });
   * ```
   *
   * ##### Chunking
   *
   * **NOTE: This function paginates the insertion of rows in chunks to avoid running into insertion limits.** This means multiple requests may be made to the server.
   *
   * This operation is **not necessarily atomic**. Depending on the amount of inserted rows, and if it's ordered or not, it can keep running (in a blocking manner) for a macroscopic amount of time. In that case, new rows that are inserted from another concurrent process/application may be inserted during the execution of this method call, and if there are duplicate keys, it's not easy to predict which application will win the race.
   *
   * By default, it inserts rows in chunks of 50 at a time. You can fine-tune the parameter through the `chunkSize` option. Note that increasing chunk size won't necessarily increase performance depending on row size. Instead, increasing concurrency may help.
   *
   * You can set the `concurrency` option to control how many network requests are made in parallel on unordered insertions. Defaults to `8`.
   *
   * @example
   * ```ts
   * const rows = Array.from({ length: 100 }, (_, i) => ({ id: i }));
   * await table.insertMany(rows, { batchSize: 100 });
   * ```
   *
   * ##### Upsert behavior
   *
   * When inserting a row with a primary key that already exists, the new row will be merged with the existing row, with the new values taking precedence.
   *
   * If you want to delete old values, you must explicitly set them to `null` (not `undefined`).
   *
   * @example
   * ```ts
   * // Since insertion is ordered, the last unique value for each
   * // primary key will be the one that remains in the table.
   * await table.insertMany([
   *   { id: '123', col1: 'I exist' },
   *   { id: '123', col1: 'I am new' },
   *   { id: '123', col2: 'me2' },
   * ], { ordered: true });
   *
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'I am new', col2: 'me2' }
   *
   * // Since insertion is unordered, it can not be 100% guaranteed
   * // which value will remain in the table for each primary key,
   * // as concurrent insertions may occur.
   * await table.insertMany([
   *   { id: '123', col1: null },
   *   { id: '123', col1: 'hi' },
   * ]);
   *
   * // coll1 may technically be either 'hi' or null
   * await table.findOne({ id: '123' }); // { id: '123', col1: ? }
   * ```
   *
   * ##### Ordered insertions
   *
   * You may set the `ordered` option to `true` to stop the operation after the first error; otherwise all rows may be parallelized and processed in arbitrary order, improving, perhaps vastly, performance.
   *
   * Setting the `ordered` operation disables any parallelization so insertions truly are stopped after the very first error.
   *
   * Setting `ordered` also guarantees the order of upsert behavior, as described above.
   *
   * ##### The primary key
   *
   * The type of the primary key of the table is inferred from the second `PKey` type-param of the table.
   *
   * If not present, it defaults to `Partial<RSchema>` to keep the result type consistent.
   *
   * @example
   * ```ts
   * interface User {
   *   id: string,
   *   name: string,
   *   dob?: DataAPIDate,
   * }
   *
   * type UserPKey = Pick<User, 'id'>;
   *
   * const table = db.table<User, UserPKey>('table');
   *
   * // res.insertedIds is of type { id: string }[]
   * const res = await table.insertMany([
   *   { id: '123', thing: 'Sunrise' },
   *   { id: '456', thing: 'Miso soup' },
   * ]);
   * console.log(res.insertedIds[0].id); // '123'
   * ```
   *
   * ##### `InsertManyError`
   *
   * If some rows can't be inserted, (e.g. they have the wrong data type for a column or lack the primary key), the Data API validation check will fail for those entire specific requests containing the faulty rows.
   *
   * Depending on concurrency & the `ordered` parameter, some rows may still have been inserted.
   *
   * In such cases, the operation will throw a {@link TableInsertManyError} containing the partial result.
   *
   * If a thrown exception is not due to an insertion error, e.g. a `5xx` error or network error, the operation will throw the underlying error.
   *
   * In case of an unordered request, if the error was a simple insertion error, the {@link TableInsertManyError} will be thrown after every row has been attempted to be inserted. If it was a `5xx` or similar, the error will be thrown immediately.
   *
   * @param rows - The rows to insert.
   * @param options - The options for this operation.
   *
   * @returns The primary keys of the inserted rows (and the count)
   *
   * @throws TableInsertManyError - If the operation fails.
   */
  public async insertMany(rows: readonly WSchema[], options?: TableInsertManyOptions): Promise<TableInsertManyResult<PKey>> {
    return this.#commands.insertMany(rows, options, TableInsertManyError);
  }

  /**
   * ##### Overview
   *
   * Updates a single row in the table. Under certain conditions, it may insert or delete a row as well.
   *
   * @example
   * ```ts
   * await table.insertOne({ key: '123', name: 'Jerry' });
   * await table.updateOne({ key: '123' }, { $set: { name: 'Geraldine' } });
   * ```
   *
   * ##### Upserting
   *
   * If the row doesn't exist, *and you're `$set`-ing at least one row to a non-null value,* an upsert will occur.
   *
   * @example
   * ```ts
   * // No upsert will occur here since only nulls are being set
   * // (this is equivalent to `{ $unset: { name: '' } }`)
   * await table.updateOne({ key: '123' }, { $set: { name: null } });
   *
   * // An upsert will occur here since at least one non-null value is being set
   * await table.updateOne({ key: '123' }, { $set: { name: 'Eleanor', age: null } });
   * ```
   *
   * ##### Deleting
   *
   * If the row was only upserted in the first place, and now all (non-primary) rows are set to null (or unset), the row will be deleted.
   *
   * _If the row was inserted on, even if it was upserted first, it will not be deleted._
   *
   * Note that `$set`-ing a row to `null` is equivalent to `$unset`-ing it. The following example would be the exact same using `$unset`s.
   *
   * @example
   * ```ts
   * // Upserts row { key: '123', name: 'Michael', age: 3 } into the table
   * await table.updateOne({ key: '123' }, { $set: { name: 'Michael', age: 3 } });
   *
   * // Sets row to { key: '123', name: 'Michael', age: null }
   * await table.updateOne({ key: '123' }, { $set: { age: null } });
   *
   * // Deletes row from the table as all non-primary keys are set to null
   * await table.updateOne({ key: '123' }, { $set: { name: null } });
   * ```
   *
   * ##### Filtering
   *
   * The filter must contain an exact primary key to update just one row.
   *
   * Attempting to pass an empty filter, filtering by only part of the primary key, or filtering by a non-primary key column will result in an error.
   *
   * ##### Update operators
   *
   * Updates may perform either `$set` or`$unset` operations on the row. (`$set`-ing a row to `null` is equivalent to `$unset`-ing it.)
   *
   * ##### On returning `void`
   *
   * The `updateOne` operation, as returned from the Data API, is always `{ matchedCount: 1, modifiedCount: 1 }`, regardless of how many things are actually matched/modified, and if a row is upserted or not.
   *
   * In that sense, returning constantly that one type is isomorphic to just returning `void`, as both realistically contain the same amount of information (i.e. none)
   *
   * @param filter - A filter to select the row to update.
   * @param update - The update to apply to the selected row.
   * @param timeout - The timeout for this operation.
   *
   * @returns A promise which resolves once the operation is completed.
   */
  public async updateOne(filter: TableFilter<WSchema>, update: TableUpdateFilter<WSchema>, timeout?: WithTimeout<'generalMethodTimeoutMs'>): Promise<void> {
    await this.#commands.updateOne(filter, update, timeout);
  }

  /**
   * ##### Overview
   *
   * Deletes a single row from the table.
   *
   * @example
   * ```ts
   * await table.insertOne({ pk: 'abc', ck: 3 });
   * await table.deleteOne({ pk: 'abc', ck: 3 });
   * ```
   *
   * ##### Filtering
   *
   * The filter must contain an exact primary key to delete just one row.
   *
   * Attempting to pass an empty filter, filtering by only part of the primary key, or filtering by a non-primary key column will result in an error.
   *
   * ##### On returning `void`
   *
   * The `deleteOne` operation, as returned from the Data API, is always `{ deletedCount: -1 }`, regardless of how many things are actually matched/modified.
   *
   * In that sense, returning constantly that one type is isomorphic to just returning `void`, as both realistically contain the same amount of information (i.e. none)
   *
   * @param filter - A filter to select the row to delete.
   * @param timeout - The timeout for this operation.
   *
   * @returns A promise which resolves once the operation is completed.
   */
  public async deleteOne(filter: TableFilter<WSchema>, timeout?: WithTimeout<'generalMethodTimeoutMs'>): Promise<void> {
    await this.#commands.deleteOne(filter, timeout);
  }

  /**
   * ##### Overview
   *
   * Deletes many rows from the table.
   *
   * @example
   * ```ts
   * await table.insertOne({ pk: 'abc', ck: 3 });
   * await table.insertOne({ pk: 'abc', ck: 4 });
   * await table.deleteMany({ pk: 'abc' });
   * ```
   *
   * ##### Filtering
   *
   * There are different forms of accepted filters:
   * - Providing the full primary key to delete a single row
   * - With some or all of the `partitionSort` columns not provided
   *   - The least significant of them can also use an inequality/range predicate
   * - Using an empty filter to truncate the entire table
   *
   * ##### On returning `void`
   *
   * The `deleteMany` operation, as returned from the Data API, is always `{ deletedCount: -1 }`, regardless of how many things are actually matched/modified.
   *
   * In that sense, returning constantly that one type is isomorphic to just returning `void`, as both realistically contain the same amount of information (i.e. none)
   *
   * @param filter - A filter to select the row(s) to delete.
   * @param timeout - The timeout for this operation.
   *
   * @returns A promise which resolves once the operation is completed.
   */
  public async deleteMany(filter: TableFilter<WSchema>, timeout?: WithTimeout<'generalMethodTimeoutMs'>): Promise<void> {
    await this.#commands.deleteMany(filter, timeout);
  }

  /**
   * ##### Overview
   *
   * Find rows in the table, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const cursor = await table.find({ name: 'John Doe' });
   * const docs = await cursor.toArray();
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Table.find} is used for when no projection is provided, and it is safe to assume the returned rows are going to be of type `Schema`.
   *
   * If it can not be inferred that a projection is definitely not provided, the `Schema` is forced to be `Partial<Schema>` if the user does not provide their own, in order to prevent type errors and ensure the user is aware that the row may not be of the same type as `Schema`.
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the rows. See {@link TableFilter} for much more information.
   *
   * If the filter is empty, all rows in the table will be returned (up to any provided/implied limit).
   *
   * ##### Find by vector search
   *
   * If the table has vector search enabled, you can find the most relevant rows by providing a vector in the sort option.
   *
   * Vector ANN searches cannot return more than a set number of rows, which, at the time of writing, is 1000 items.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', vector: [.52, .32, .12] },
   * ]);
   *
   * const cursor = table.find({}, {
   *   sort: { vector: [.12, .52, .32] },
   * });
   *
   * // Returns 'John Doe'
   * console.log(await cursor.next());
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to sort the rows returned by the cursor. See {@link Sort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to the order of the rows returned.
   *
   * When providing a non-vector sort, the Data API will return a smaller number of rows, set to 20 at the time of writing, and stop there. The returned rows are the top results across the whole table according to the requested criterion.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const cursor = table.find({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // Returns 'John Doe' (age 2, height 42), 'John Doe' (age 1, height 168)
   * console.log(await cursor.toArray());
   * ```
   *
   * ##### Other options
   *
   * Other available options include `skip`, `limit`, `includeSimilarity`, and `includeSortVector`. See {@link TableFindOptions} and {@link FindCursor} for more information.
   *
   * If you prefer, you may also set these options using a fluent interface on the {@link FindCursor} itself.
   *
   * @example
   * ```ts
   * // cursor :: FindCursor<string>
   * const cursor = table.find({})
   *   .sort({ vector: [.12, .52, .32] })
   *   .projection<{ name: string, age: number }>({ name: 1, age: 1 })
   *   .includeSimilarity(true)
   *   .map(doc => `${doc.name} (${doc.age})`);
   * ```
   *
   * @remarks
   * When not specifying sorting criteria at all (by vector or otherwise),
   * the cursor can scroll through an arbitrary number of rows as
   * the Data API and the client periodically exchange new chunks of rows.
   *
   * --
   *
   * It should be noted that the behavior of the cursor in the case rows
   * have been added/removed after the `find` was started depends on database
   * internals, and it is not guaranteed, nor excluded, that such "real-time"
   * changes in the data would be picked up by the cursor.
   *
   * @param filter - A filter to select the rows to find. If not provided, all rows will be returned.
   * @param options - The options for this operation.
   *
   * @returns a {@link FindCursor} which can be iterated over.
   */
  public find(filter: TableFilter<WSchema>, options?: TableFindOptions & { projection?: never }): TableFindCursor<WithSim<RSchema>, WithSim<RSchema>>;

  /**
   * ##### Overview
   *
   * Find rows in the table, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const cursor = await table.find({ name: 'John Doe' });
   * const docs = await cursor.toArray();
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Table.find} is used for when a projection is provided (or at the very least, it can not be inferred that a projection is NOT provided).
   *
   * In this case, the user must provide an explicit projection type, or the type of the rows will be `Partial<Schema>`, to prevent type-mismatches when the schema is strictly provided.
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   car: { make: string, model: string },
   * }
   *
   * const table = db.table<User>('users');
   *
   * // Defaulting to `Partial<User>` when projection is not provided
   * const cursor = await table.find({}, {
   *   projection: { car: 1 },
   * });
   *
   * // next :: { car?: { make?: string, model?: string } }
   * const next = await cursor.next();
   * console.log(next.car?.make);
   *
   * // Explicitly providing the projection type
   * const cursor = await table.find<Pick<User, 'car'>>({}, {
   *   projection: { car: 1 },
   * });
   *
   * // next :: { car: { make: string, model: string } }
   * const next = await cursor.next();
   * console.log(next.car.make);
   *
   * // Projection existence can not be inferred
   * function mkFind(projection?: Projection) {
   *   return table.find({}, { projection });
   * }
   *
   * // next :: Partial<User>
   * const next = await mkFind({ car: 1 }).next();
   * console.log(next.car?.make);
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the rows. See {@link TableFilter} for much more information.
   *
   * If the filter is empty, all rows in the table will be returned (up to any provided/implied limit).
   *
   * ##### Find by vector search
   *
   * If the table has vector search enabled, you can find the most relevant rows by providing a vector in the sort option.
   *
   * Vector ANN searches cannot return more than a set number of rows, which, at the time of writing, is 1000 items.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', vector: [.52, .32, .12] },
   * ]);
   *
   * const cursor = table.find({}, {
   *   sort: { vector: [.12, .52, .32] },
   * });
   *
   * // Returns 'John Doe'
   * console.log(await cursor.next());
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to sort the rows returned by the cursor. See {@link Sort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to the order of the rows returned.
   *
   * When providing a non-vector sort, the Data API will return a smaller number of rows, set to 20 at the time of writing, and stop there. The returned rows are the top results across the whole table according to the requested criterion.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const cursor = table.find({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // Returns 'John Doe' (age 2, height 42), 'John Doe' (age 1, height 168)
   * console.log(await cursor.toArray());
   * ```
   *
   * ##### Other options
   *
   * Other available options include `skip`, `limit`, `includeSimilarity`, and `includeSortVector`. See {@link TableFindOptions} and {@link FindCursor} for more information.
   *
   * If you prefer, you may also set these options using a fluent interface on the {@link FindCursor} itself.
   *
   * @example
   * ```ts
   * // cursor :: FindCursor<string>
   * const cursor = table.find({})
   *   .sort({ vector: [.12, .52, .32] })
   *   .projection<{ name: string, age: number }>({ name: 1, age: 1 })
   *   .includeSimilarity(true)
   *   .map(doc => `${doc.name} (${doc.age})`);
   * ```
   *
   * @remarks
   * When not specifying sorting criteria at all (by vector or otherwise),
   * the cursor can scroll through an arbitrary number of rows as
   * the Data API and the client periodically exchange new chunks of rows.
   *
   * --
   *
   * It should be noted that the behavior of the cursor in the case rows
   * have been added/removed after the `find` was started depends on database
   * internals, and it is not guaranteed, nor excluded, that such "real-time"
   * changes in the data would be picked up by the cursor.
   *
   * @param filter - A filter to select the rows to find. If not provided, all rows will be returned.
   * @param options - The options for this operation.
   *
   * @returns a {@link FindCursor} which can be iterated over.
   */
  public find<TRaw extends SomeRow = Partial<RSchema>>(filter: TableFilter<WSchema>, options: TableFindOptions): TableFindCursor<TRaw, TRaw>;

  public find(filter: TableFilter<WSchema>, options?: TableFindOptions): TableFindCursor<SomeDoc> {
    return this.#commands.find(filter, options, TableFindCursor);
  }
  
  /**
   * ##### Overview
   *
   * Find a single row in the table, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const doc = await table.findOne({ name: 'John Doe' });
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Table.findOne} is used for when no projection is provided, and it is safe to assume the returned row is going to be of type `Schema`.
   *
   * If it can not be inferred that a projection is definitely not provided, the `Schema` is forced to be `Partial<Schema>` if the user does not provide their own, in order to prevent type errors and ensure the user is aware that the row may not be of the same type as `Schema`.
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the row. See {@link TableFilter} for much more information.
   *
   * If the filter is empty, and no {@link Sort} is present, it's undefined as to which row is selected.
   *
   * ##### Find by vector search
   *
   * If the table has vector search enabled, you can find the most relevant row by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', vector: [.52, .32, .12] },
   * ]);
   *
   * const doc = table.findOne({}, {
   *   sort: { vector: [.12, .52, .32] },
   * });
   *
   * // 'John Doe'
   * console.log(doc.name);
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to pick the most relevant row. See {@link Sort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to which of the rows which matches the filter is returned.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const doc = table.findOne({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // 'John Doe' (age 2, height 42)
   * console.log(doc.name);
   * ```
   *
   * ##### Other options
   *
   * Other available options include `includeSimilarity`. See {@link TableFindOneOptions} for more information.
   *
   * If you want to get `skip` or `includeSortVector` as well, use {@link Table.find} with a `limit: 1` instead.
   *
   * @example
   * ```ts
   * const doc = await cursor.findOne({}, {
   *   sort: { vector: [.12, .52, .32] },
   *   includeSimilarity: true,
   * });
   * ```
   *
   * @param filter - A filter to select the rows to find. If not provided, all rows will be returned.
   * @param options - The options for this operation.
   *
   * @returns A row matching the criterion, or `null` if no such row exists.
   */
  public async findOne(filter: TableFilter<WSchema>, options?: TableFindOneOptions & { projection?: never }): Promise<WithSim<RSchema> | null>;

  /**
   * ##### Overview
   *
   * Find a single row in the table, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const doc = await table.findOne({ name: 'John Doe' });
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Table.findOne} is used for when a projection is provided (or at the very least, it can not be inferred that a projection is NOT provided).
   *
   * In this case, the user must provide an explicit projection type, or the type of the returned row will be as `Partial<Schema>`, to prevent type-mismatches when the schema is strictly provided.
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   car: { make: string, model: string },
   * }
   *
   * const table = db.table<User>('users');
   *
   * // Defaulting to `Partial<User>` when projection is not provided
   * const doc = await table.findOne({}, {
   *   projection: { car: 1 },
   * });
   *
   * // doc :: { car?: { make?: string, model?: string } }
   * console.log(doc.car?.make);
   *
   * // Explicitly providing the projection type
   * const doc = await table.findOne<Pick<User, 'car'>>({}, {
   *   projection: { car: 1 },
   * });
   *
   * // doc :: { car: { make: string, model: string } }
   * console.log(doc.car.make);
   *
   * // Projection existence can not be inferred
   * function findOne(projection?: Projection) {
   *   return table.findOne({}, { projection });
   * }
   *
   * // doc :: Partial<User>
   * const doc = await findOne({ car: 1 }).next();
   * console.log(doc.car?.make);
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the row. See {@link TableFilter} for much more information.
   *
   * If the filter is empty, and no {@link Sort} is present, it's undefined as to which row is selected.
   *
   * ##### Find by vector search
   *
   * If the table has vector search enabled, you can find the most relevant row by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', vector: [.52, .32, .12] },
   * ]);
   *
   * const doc = table.findOne({}, {
   *   sort: { vector: [.12, .52, .32] },
   * });
   *
   * // 'John Doe'
   * console.log(doc.name);
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to pick the most relevant row. See {@link Sort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to which of the rows which matches the filter is returned.
   *
   * @example
   * ```ts
   * await table.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const doc = table.findOne({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // 'John Doe' (age 2, height 42)
   * console.log(doc.name);
   * ```
   *
   * ##### Other options
   *
   * Other available options include `includeSimilarity`. See {@link TableFindOneOptions} for more information.
   *
   * If you want to get `skip` or `includeSortVector` as well, use {@link Table.find} with a `limit: 1` instead.
   *
   * @example
   * ```ts
   * const doc = await cursor.findOne({}, {
   *   sort: { vector: [.12, .52, .32] },
   *   includeSimilarity: true,
   * });
   * ```
   *
   * @param filter - A filter to select the rows to find. If not provided, all rows will be returned.
   * @param options - The options for this operation.
   *
   * @returns A row matching the criterion, or `null` if no such row exists.
   */
  public async findOne<TRaw extends SomeRow = Partial<RSchema>>(filter: TableFilter<WSchema>, options: TableFindOneOptions): Promise<TRaw | null>;

  public async findOne(filter: TableFilter<WSchema>, options?: TableFindOneOptions): Promise<SomeDoc | null> {
    return this.#commands.findOne(filter, options);
  }

  /**
   * ##### Overview
   *
   * Performs one of the four available table-alteration operations:
   * - `add` (adds columns to the table)
   * - `drop` (removes columns from the table)
   * - `addVectorize` (enabled auto-embedding-generation on existing vector columns)
   * - `dropVectorize` (disables vectorize on existing enabled columns)
   *
   * @example
   * ```ts
   * interface User {
   *   id: UUID,
   *   vector: DataAPIVector,
   * }
   * const table = db.table<User>('users');
   *
   * // Add a column to the table
   * type NewUser = User & { name: string };
   *
   * const newTable = await table.alter<NewUser>({
   *  operation: {
   *    add: {
   *      columns: { name: 'text' },
   *    },
   *  },
   * });
   *
   * // Drop a column from the table (resets it to how it was originally)
   * const oldTable = await newTable.alter<User>({
   *   operation: {
   *     drop: {
   *       columns: ['name'],
   *     },
   *   },
   * });
   * ```
   *
   * ##### On returning `Table`
   *
   * The `alter` operation returns the table itself, with the new schema type.
   *
   * It is heavily recommended to store the result of the `alter` operation in a new variable, as the old table will not have the new schema type.
   *
   * You should provide the exact new type of the schema, or it'll just default to `SomeRow`.
   *
   * @param options - The options for this operation.
   *
   * @returns The table with the new schema type.
   */
  public async alter<NewWSchema extends SomeRow, NewRSchema extends SomeRow = FoundRow<NewWSchema>>(options: AlterTableOptions<SomeRow>): Promise<Table<NewWSchema, PKey, NewRSchema>> {
    await this.#httpClient.executeCommand({
      alterTable: {
        operation: options.operation,
      },
    }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
    });
    return this as unknown as Table<NewWSchema, PKey, NewRSchema>;
  }

  /**
   * Lists the index names for this table.
   *
   * If you want to include the index definitions in the response, set `nameOnly` to `false` (or omit it completely),
   * using the other overload.
   *
   * @example
   * ```typescript
   * // ['my_vector_index', ...]
   * console.log(await table.listIndexes({ nameOnly: true }));
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of index names.
   */
  public async listIndexes(options: ListIndexOptions & { nameOnly: true }): Promise<string[]>

  /**
   * Lists the indexes for this table.
   *
   * If you want to use only the index names, set `nameOnly` to `true`, using the other overload.
   *
   * @example
   * ```typescript
   * // [{ name: 'm_vector_index', definition: { ... } }, ...]
   * console.log(await db.listTables());
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of index info.
   */
  public async listIndexes(options?: ListIndexOptions & { nameOnly?: false }): Promise<TableIndexDescriptor[]>

  public async listIndexes(options?: ListIndexOptions): Promise<string[] | TableIndexDescriptor[]> {
    const resp = await this.#httpClient.executeCommand({
      listIndexes: {
        options: {
          explain: options?.nameOnly !== true,
        },
      },
    }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
    });
    return resp.status!.indexes;
  }

  /**
   * ##### Overview
   *
   * Creates a secondary non-vector index on the table.
   *
   * The operation blocks until the index is created and ready to use.
   *
   * See {@link Table.createVectorIndex} for creating vector indexes.
   *
   * ##### Text indexes
   *
   * `text` and `ascii`-based indexes have access to a few additional options:
   * - `caseSensitive` (default: `true`)
   *   - Allows searches to be case-insensitive, if false
   * - `normalize` (default: `true`)
   *   - Normalize Unicode characters and diacritics before indexing, if true
   * - `ascii` (default: `false`)
   *   - Converts non-ASCII characters to their US-ASCII equivalent before indexing, if true
   *
   * @param name - The name of the index
   * @param column - The column to index
   * @param options - Options for this operation
   *
   * @returns A promise which resolves once the index is created.
   */
  public async createIndex(name: string, column: WSchema | string, options?: CreateTableIndexOptions): Promise<void> {
    await this.#httpClient.executeCommand({
      createIndex: {
        name: name,
        definition: {
          column,
          options: {
            caseSensitive: options?.options?.caseSensitive,
            normalize: options?.options?.normalize,
            ascii: options?.options?.ascii,
          },
        },
        options: {
          ifNotExists: options?.ifNotExists,
        },
      },
    }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
    });
  }

  /**
   * Creates an index on an existing vector column in the table.
   *
   * The operation blocks until the index is created and ready to use.
   *
   * See {@link Table.createIndex} for creating non-vector indexes.
   *
   * @param name - The name of the index
   * @param column - The vector column to index
   * @param options - Options for this operation
   *
   * @returns A promise which resolves once the index is created.
   */
  public async createVectorIndex(name: string, column: WSchema | string, options?: CreateTableVectorIndexOptions): Promise<void> {
    await this.#httpClient.executeCommand({
      createVectorIndex: {
        name: name,
        definition: {
          column,
          options: {
            sourceModel: options?.options?.sourceModel,
            metric: options?.options?.metric,
          },
        },
        options: {
          ifNotExists: options?.ifNotExists,
        },
      },
    }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
    });
  }

  /**
   * ##### Overview
   *
   * Get the table definition, i.e. it's columns and primary key definition.
   *
   * The method issues a request to the Data API each time it is invoked, without caching mechanisms;
   * this ensures up-to-date information for usages such as real-time collection validation by the application.
   *
   * @example
   * ```ts
   * const definition = await table.definition();
   * console.log(definition.columns);
   * ```
   *
   * @param options - The options for this operation.
   *
   * @returns The definition of the table.
   */
  public async definition(options?: WithTimeout<'tableAdminTimeoutMs'>): Promise<ListTableDefinition> {
    const resp = await this.#db.listTables({
      timeout: options?.timeout,
      keyspace: this.keyspace,
    });

    const table = resp.find((t) => t.name === this.name);

    if (!table) {
      throw new Error(`Can not get definition for table '${this.keyspace}.${this.name}'; table not found. Did you use the right keyspace?`);
    }

    return table.definition;
  }

  /**
   * ##### Overview
   *
   * Drops the table from the database, including all the rows it contains.
   *
   * @example
   * ```typescript
   * const table = await db.table('my_table');
   * await table.drop();
   * ```
   *
   * ##### Disclaimer
   *
   * Once the table is dropped, this object is still technically "usable", but any further operations on it
   * will fail at the Data API level; thus, it's the user's responsibility to make sure that the table object
   * is no longer used.
   *
   * @param options - The options for this operation.
   *
   * @returns A promise which resolves when the table has been dropped.
   *
   * @remarks Use with caution. Wear your safety goggles. Don't say I didn't warn you.
   */
  public async drop(options?: Omit<DropTableOptions, 'keyspace'>): Promise<void> {
    await this.#db.dropTable(this.name, { ...options, keyspace: this.keyspace });
  }

  /**
   * Backdoor to the HTTP client for if it's absolutely necessary. Which it almost never (if even ever) is.
   */
  public get _httpClient(): OpaqueHttpClient {
    return this.#httpClient;
  }
}
