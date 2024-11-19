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
  CreateTableVectorIndexOptions,
  Filter,
  FoundRow,
  KeyOf,
  SomeDoc,
  SomeRow,
  TableDeleteOneOptions,
  TableFindOneOptions,
  TableFindOptions,
  TableInsertManyError,
  TableInsertManyOptions,
  TableInsertManyResult,
  TableInsertOneResult,
  TableUpdateOneOptions,
  UpdateFilter,
} from '@/src/documents';
import { BigNumberHack, DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { CommandImpls } from '@/src/documents/commands/command-impls';
import { AlterTableOptions, AlterTableSchema, Db, ListTableDefinition, TableSpawnOptions } from '@/src/db';
import { DeepPartial, WithTimeout } from '@/src/lib';
import { $CustomInspect } from '@/src/lib/constants';
import { mkTableSerDes } from '@/src/documents/tables/ser-des';
import JBI from 'json-bigint';
import { TableFindCursor } from '@/src/documents/tables/cursor';
import { withJbiNullProtoFix } from '@/src/lib/utils';

const jbi = JBI({ storeAsString: true });

/**
 * Represents the columns of a table row, excluding the primary key columns.
 *
 * Useful for when you want to do `keyof Schema`, but you're getting `'$PrimaryKeyType'` as well in the
 * resulting union (which you don't want).
 *
 * @example
 * ```ts
 * interface User extends Row<User, 'id'> {
 *   id: string,
 *   friends: Map<string, UUID>,
 * }
 *
 * type Crying = keyof User; // 'id' | 'friends' | '$PrimaryKeyType'
 * type Happy = Cols<User>; // 'id' | 'friends'
 * ```
 *
 * @see Table
 * @see $PrimaryKeyType
 *
 * @public
 */
export type Cols<Schema> = keyof Omit<Schema, '$PrimaryKeyType'>;

/**
 * #### Overview
 *
 * Represents the interface to a table in a Data-API-enabled database.
 *
 * **This shouldn't be directly instantiated, but rather created via {@link Db.createTable} or {@link Db.table}**.
 *
 * #### Typing & Types
 *
 * A `Table` is typed as `Table<Schema extends SomeRow = SomeRow>`, where:
 *  - `Schema` is the type of the rows in the table (the table schema).
 *  - `SomeRow` is set to `Record<string, any>`, representing any valid JSON object.
 *
 * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
 *
 * For example:
 *  - `'map<k, v>'` is represented by a native JS `Map<K, V>`
 *  - `'vector'` is represented by an `astra-db-ts` provided `DataAPIVector`
 *  - `'date'` is represented by an `astra-db-ts` provided `CqlDate`
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
 *   friends: new Map([['Alice', UUID.random()]]),
 *   vector: new DataAPIVector([1, 2, 3]),
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
 *   dob: CqlDate, // Clustering (partition sort) key
 *   friends: Map<string, UUID>,
 *   [$PrimaryKeyType]?: {
 *     id: string,
 *     dob: CqlDate,
 *   },
 * }
 *
 * // res.insertedId is of type { id: string }
 * const res = await db.table<User>('users').insertOne({
 *   id: '123',
 *   dob: new CqlDate(new Date()),
 *   friends: new Map([['Alice', UUID.random()]]),
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
 *   dob: CqlDate, // Clustering (partition sort) key
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
 * //   dob: CqlDate,
 * //   friends?: Map<string, UUID>, // Optional since it's not in the primary key
 * //   [$PrimaryKeyType]?: {
 * //     id: string,
 * //     dob: CqlDate,
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
 * You can plug in your own custom datatypes by providing some custom serialization/deserialization logic through the `serdes` option in {@link TableSpawnOptions}, {@link DbSpawnOptions} & {@link DataAPIClientOptions.dbOptions}.
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
 * @see TableSpawnOptions
 * @see $PrimaryKeyType
 *
 * @public
 */
export class Table<Schema extends SomeRow = SomeRow> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #commands: CommandImpls<Schema, KeyOf<Schema>>;
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
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: TableSpawnOptions<Schema> | undefined) {
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
    this.#commands = new CommandImpls(this, this.#httpClient, mkTableSerDes(opts?.serdes));
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
   * import { UUID, ObjectId, ... } from '@datastax/astra-db-ts';
   *
   * // Insert a row with a specific ID
   * await table.insertOne({ id: 'text-id', name: 'John Doe' });
   * await table.insertOne({ id: UUID.v7(), name: 'Dane Joe' });
   *
   * // Insert a row with a vector (if enabled on the collection)
   * const vector = new DataAPIVector([.12, .52, .32]); // class enables faster encoding
   * await table.insertOne({ id: 1, name: 'Jane Doe', vector });
   *
   * // or if vectorize (auto-embedding-generation) is enabled for the column
   * await table.insertOne({ id: 1, name: 'Jane Doe', vector: "Hey there!" });
   * ```
   *
   * ##### The primary key
   *
   * The columns that compose the primary key themselves must all be present in the row object; all other fields are technically optional/nullable.
   *
   * The type of the primary key of the table (for the `insertedId`) is inferred from the `$PrimaryKeyType` key in the schema. If it's not present, it will default to {@link SomeTableKey} (See {@link Table}, {@link $PrimaryKeyType} for more info).
   *
   * @example
   * ```ts
   * interface User extends Row<User, 'id'> {
   *   id: string,
   *   name: string,
   *   dob?: CqlDate,
   * }
   *
   * // res.insertedId is of type { id: string }
   * const res = await table.insertOne({ id: '123', name: 'Alice' });
   * console.log(res.insertedId.id); // '123'
   * ```
   *
   * @param row - The row to insert.
   * @param options - The options for this operation.
   *
   * @returns The ID of the inserted row.
   */
  public async insertOne(row: Schema, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<TableInsertOneResult<Schema>> {
    return this.#commands.insertOne(row, options);
  }

  public async insertMany(document: readonly Schema[], options?: TableInsertManyOptions): Promise<TableInsertManyResult<Schema>> {
    return this.#commands.insertMany(document, options, TableInsertManyError);
  }

  public async updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: TableUpdateOneOptions): Promise<void> {
    await this.#commands.updateOne(filter, update, options);
  }

  public async deleteOne(filter: Filter<Schema>, options?: TableDeleteOneOptions): Promise<void> {
    await this.#commands.deleteOne(filter, options);
  }

  public async deleteMany(filter: Filter<Schema>, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<void> {
    await this.#commands.deleteMany(filter, options);
  }

  public find(filter: Filter<Schema>, options?: TableFindOptions & { projection?: never }): TableFindCursor<FoundRow<Schema>, FoundRow<Schema>>

  public find<TRaw extends SomeRow = DeepPartial<Schema>>(filter: Filter<Schema>, options: TableFindOptions): TableFindCursor<FoundRow<TRaw>, FoundRow<TRaw>>

  public find(filter: Filter<Schema>, options?: TableFindOptions): TableFindCursor<SomeDoc> {
    return this.#commands.find(filter, options, TableFindCursor);
  }

  public async findOne(filter: Filter<Schema>, options?: TableFindOneOptions): Promise<FoundRow<Schema> | null> {
    return this.#commands.findOne(filter, options);
  }

  public async alter<const Spec extends AlterTableOptions<Schema>>(options: Spec): Promise<Table<AlterTableSchema<Schema, Spec>>>

  public async alter<NewSchema extends SomeRow>(options: AlterTableOptions<Schema>): Promise<Table<NewSchema>>

  public async alter(options: AlterTableOptions<Schema>): Promise<unknown> {
    await this.#httpClient.executeCommand({
      alterTable: {
        name: this.name,
        operation: options.operation,
      },
    }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
    });
    return this;
  }

  public async createIndex(name: string, column: Cols<Schema> | string, options?: CreateTableIndexOptions): Promise<void> {
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

  public async createVectorIndex(name: string, column: Cols<Schema> | string, options?: CreateTableVectorIndexOptions): Promise<void> {
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
    const results = await this.#db.listTables({
      timeout: options?.timeout,
      keyspace: this.keyspace,
    });

    const table = results.find((t) => t.name === this.name);

    if (!table) {
      throw new Error(`Can not get definition for table '${this.keyspace}.${this.name}'; table not found. Did you use the right keyspace?`);
    }

    return table.definition;
  }

  public async drop(options?: WithTimeout<'tableAdminTimeoutMs'>): Promise<void> {
    await this.#db.dropTable(this.name, { keyspace: this.keyspace, ...options });
  }

  public get _httpClient() {
    return this.#httpClient;
  }
}
