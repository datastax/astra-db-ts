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

import {
  CreateTableIndexOptions,
  CreateTableVectorIndexOptions, FoundRow,
  SomeDoc,
  SomeRow,
  TableFilter,
  TableFindOneOptions,
  TableFindOptions,
  TableInsertManyError,
  TableInsertManyOptions,
  TableInsertManyResult,
  TableInsertOneResult,
  TableUpdateFilter, WithSim,
} from '@/src/documents';
import { BigNumberHack, DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { CommandImpls } from '@/src/documents/commands/command-impls';
import { AlterTableOptions, Db, DropTableOptions, ListTableDefinition, TableOptions } from '@/src/db';
import { nullish, WithTimeout } from '@/src/lib';
import { $CustomInspect } from '@/src/lib/constants';
import JBI from 'json-bigint';
import { TableFindCursor } from '@/src/documents/tables/cursor';
import { withJbiNullProtoFix } from '@/src/lib/utils';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';
import { ListIndexOptions, TableIndexDescriptor } from '@/src/db/types/tables/list-indexes';

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
 *   definition: {
 *      columns: {
 *        id: 'text',
 *        name: 'text',
 *      },
 *      primaryKey: 'id',
 *   },
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
 * The primary key of the table should be provided via the `$PrimaryKeyType` key in the schema.
 *
 * This is a special type that is used to reconstruct the TS type of the primary key in insert operations. It should be an optional object with the same keys as the primary key columns, and the same types as the schema. Note that there is no distinction between partition and clustering keys in this type.
 *
 * **Note that this symbol is never present in the actually runtime object. It is effectively just a phantom type for type-inference purposes**
 *
 * @example
 * ```ts
 * interface User {
 *   id: string,   // Partition key
 *   dob: DataAPIDate, // Clustering (partition sort) key
 *   friends: Map<string, UUID>,
 *   [$PrimaryKeyType]?: {
 *     id: string,
 *     dob: DataAPIDate,
 *   },
 * }
 *
 * // res.insertedId is of type { id: string }
 * const res = await db.table<User>('users').insertOne({
 *   id: '123',
 *   dob: date(), // or new DataAPIDate(new Date())
 *   friends: new Map([['Alice', uuid(4)]]), // or UUID.v4()
 * });
 * ```
 *
 * A convenient shorthand exists for this, by extending the {@link Row} type. Simply provide the schema as the first argument, and the keys of the primary key (both partition & clustering/sort) as the second argument.
 *
 * @example
 * ```ts
 * // equivalent to the above
 * interface User extends Row<User, 'id' | 'dob'> {
 *   id: string,   // Partition key
 *   dob: DataAPIDate, // Clustering (partition sort) key
 *   friends: Map<string, UUID>,
 * }
 * ```
 *
 * ###### `db.createTable` type inference
 *
 * When creating a table through {@link Db.createTable}, and not using any custom datatypes (see next session), you can actually use the {@link InferTableSchema} or {@link InferTableSchemaFromDefinition} utility types to infer the schema of the table from the table creation.
 *
 * @example
 * ```ts
 * // equivalent to:
 * // type User = {
 * //   id: string,
 * //   dob: DataAPIDate,
 * //   friends?: Map<string, UUID>, // Optional since it's not in the primary key
 * //   [$PrimaryKeyType]?: {
 * //     id: string,
 * //     dob: DataAPIDate,
 * //   },
 * // }
 * type User = InferTableSchema<typeof mkTable>;
 *
 * const mkTable = () => db.createTable('users', {
 *   definition: {
 *      columns: {
 *        id: 'text',
 *        dob: 'date',
 *        friends: { type: 'map', keyType: 'text', valueType: 'uuid' },
 *      },
 *      primaryKey: {
 *        partitionBy: ['id'],
 *        partitionSort: { dob: -1 }
 *      },
 *   },
 * });
 *
 * async function main() {
 *   const table = await mkTable();
 *   // ... use table
 * }
 * ```
 *
 * ###### Custom datatypes
 *
 * You can plug in your own custom datatypes by providing some custom serialization/deserialization logic through the `serdes` option in {@link TableOptions}, {@link DbOptions} & {@link DataAPIClientOptions.dbOptions}.
 *
 * See {@link TableSerDesConfig} for much more information, but here's a quick example:
 *
 * @example
 * ```ts
 * import { $SerializeForTables, ... } from '@datastax/astra-db-ts';
 *
 * // Custom datatype
 * class UserID {
 *   constructor(public readonly unwrap: string) {}
 *   [$SerializeForTables] = () => this.unwrap; // Serializer checks for this symbol
 * }
 *
 * // Schema type of the table, using the custom datatype
 * interface User extends Row<User, 'id'> {
 *   id: UserID,
 *   name: string,
 * }
 *
 * const table = db.table('users', {
 *   serdes: { // Serializer not necessary here since `$SerializeForTables` is used
 *     deserialize(key, value) {
 *       if (key === 'id') return [new UserID(value)]; // [X] specifies a new value
 *     },
 *   },
 * });
 *
 * const inserted = await table.insertOne({
 *   id: new UserID('123'), // will be stored in db as '123'
 *   name: 'Alice',
 * });
 *
 * console.log(inserted.insertedId.unwrap); // '123'
 * ```
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
 * @see TableSerDesConfig
 * @see TableOptions
 * @see $PrimaryKeyType
 *
 * @public
 */
export class Table<WSchema extends SomeRow, PKey extends SomeRow = Partial<FoundRow<WSchema>>, RSchema extends Partial<Record<keyof WSchema, any>> = FoundRow<WSchema>> {
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
   * Use {@link Db.table} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: TableOptions | undefined) {
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

    this.#httpClient = httpClient.forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(this.keyspace, this.name, opts, hack);
    this.#commands = new CommandImpls(this, this.#httpClient, new TableSerDes(opts?.serdes));
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
   * await table.insertOne({ id: '123', col1: 'i exist' });
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'i exist' }
   *
   * await table.insertOne({ id: '123', col1: 'i am new' });
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'i am new' }
   *
   * await table.insertOne({ id: '123', col2: 'me2' });
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'i am new', col2: 'me2' }
   *
   * await table.insertOne({ id: '123', col1: null });
   * await table.findOne({ id: '123' }); // { id: '123', col2: 'me2' }
   * ```
   *
   * ##### The primary key
   *
   * The columns that compose the primary key themselves must all be present in the row object; all other fields are technically optional/nullable.
   *
   * The type of the primary key of the table (for the `insertedId`) is inferred from the type-level `$PrimaryKeyType` key in the schema. If it's not present, it will default to {@link SomeTableKey} (see {@link Table}, {@link $PrimaryKeyType} for more info).
   *
   * @example
   * ```ts
   * interface User extends Row<User, 'id'> {
   *   id: string,
   *   name: string,
   *   dob?: DataAPIDate,
   * }
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
   * By default, it inserts rows in chunks of 50 at a time. You can fine-tune the parameter through the `chunkSize` option. Note that increasing chunk size won't necessarily increase performance depending on document size. Instead, increasing concurrency may help.
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
   *   { id: '123', col1: 'i exist' },
   *   { id: '123', col1: 'i am new' },
   *   { id: '123', col2: 'me2' },
   * ], { ordered: true });
   *
   * await table.findOne({ id: '123' }); // { id: '123', col1: 'i am new', col2: 'me2' }
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
   * The columns that compose the primary key themselves must all be present in the row object; all other fields are technically optional/nullable.
   *
   * The type of the primary key of the table (for the `insertedId`) is inferred from the type-level `$PrimaryKeyType` key in the schema. If it's not present, it will default to {@link SomeTableKey} (see {@link Table}, {@link $PrimaryKeyType} for more info).
   *
   * @example
   * ```ts
   * interface User extends Row<User, 'id'> {
   *   id: string,
   *   name: string,
   *   dob?: DataAPIDate,
   * }
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
   * In case of an unordered request, if the error was a simple insertion error, the {@link TableInsertManyError} will be thrown after every document has been attempted to be inserted. If it was a `5xx` or similar, the error will be thrown immediately.
   *
   * @param rows - The rows to insert.
   * @param options - The options for this operation.
   *
   * @returns The primary keys of the inserted documents (and the count)
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
   * If all (non-primary) rows are set to null (or unset), the row will be deleted.
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
   * @param filter - A filter to select the document to update.
   * @param update - The update to apply to the selected document.
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
   * await table.deleteOne({ pk: 'abc', ck: { $gt: 2 } });
   * ```
   *
   * ##### Filtering
   *
   *
   */
  public async deleteOne(filter: TableFilter<WSchema>, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<void> {
    await this.#commands.deleteOne(filter, options);
  }

  public async deleteMany(filter: TableFilter<WSchema>, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<void> {
    await this.#commands.deleteMany(filter, options);
  }

  public find<IncSim extends boolean | string | nullish>(filter: TableFilter<WSchema>, options?: TableFindOptions<IncSim> & { projection?: never }): TableFindCursor<WithSim<RSchema, IncSim>, WithSim<RSchema, IncSim>>;

  public find<TRaw extends SomeRow = Partial<RSchema>>(filter: TableFilter<WSchema>, options: TableFindOptions): TableFindCursor<TRaw, TRaw>;

  public find(filter: TableFilter<WSchema>, options?: TableFindOptions): TableFindCursor<SomeDoc> {
    return this.#commands.find(filter, options, TableFindCursor);
  }

  public async findOne<IncSim extends boolean | string | nullish>(filter: TableFilter<WSchema>, options?: TableFindOneOptions<IncSim> & { projection?: never }): Promise<WithSim<RSchema, IncSim> | null>;

  public async findOne<TRaw extends SomeRow = Partial<RSchema>>(filter: TableFilter<WSchema>, options: TableFindOneOptions): Promise<TRaw | null>;

  public async findOne(filter: TableFilter<WSchema>, options?: TableFindOneOptions): Promise<SomeDoc | null> {
    return this.#commands.findOne(filter, options);
  }

  public async alter<NewWSchema extends SomeRow, NewRSchema extends Record<keyof NewWSchema, any> = FoundRow<NewWSchema>>(options: AlterTableOptions<SomeRow>): Promise<Table<NewWSchema, PKey, NewRSchema>> {
    await this.#httpClient.executeCommand({
      alterTable: {
        operation: options.operation,
      },
    }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
    });
    return this as any;
  }

  public async listIndexes(options?: ListIndexOptions & { nameOnly: true }): Promise<string[]>

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

  public async drop(options?: Omit<DropTableOptions, 'keyspace'>): Promise<void> {
    await this.#db.dropTable(this.name, { ...options, keyspace: this.keyspace });
  }

  public get _httpClient() {
    return this.#httpClient;
  }
}
