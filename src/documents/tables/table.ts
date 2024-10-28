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
  $PrimaryKeyType,
  CreateTableIndexOptions,
  CreateTableTextIndexOptions,
  CreateTableVectorIndexOptions,
  Filter,
  FindCursor,
  FoundRow,
  KeyOf,
  mkTableSerDes,
  SomeDoc,
  SomeRow,
  TableDeleteOneOptions,
  TableFindOneOptions,
  TableFindOptions,
  TableInsertManyOptions,
  TableInsertManyResult,
  TableInsertOneResult,
  TableUpdateManyOptions,
  TableUpdateManyResult,
  TableUpdateOneOptions,
  TableUpdateOneResult,
  UpdateFilter,
} from '@/src/documents';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { CommandImpls } from '@/src/documents/commands/command-impls';
import { AlterTableOptions, AlterTableSchema, Db, TableSpawnOptions } from '@/src/db';
import { WithTimeout } from '@/src/lib';
import { constantly } from '@/src/lib/utils';

export type Cols<Schema> = keyof Omit<Schema, typeof $PrimaryKeyType | '$PrimaryKeyType'>;

/**
 * Represents the interface to a collection in the database.
 *
 * **Shouldn't be directly instantiated, but rather created via {@link Db.createCollection},
 * or connected to using {@link Db.collection}**.
 *
 * Typed as `Table<Schema>` where `Schema` is the type of the documents in the collection.
 * Operations on the collection will be strongly typed if a specific schema is provided, otherwise
 * remained largely weakly typed if no type is provided.
 *
 * See {@link Db.createTable}, {@link Db.table}, and {@link InferTableSchema} for much more information
 * about typing.
 *
 * It is on the user to ensure that the TS type of the `Table` corresponds with the actual CQL table schema, in its
 * TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.
 *
 * @see SomeRow
 * @see Db.createTable
 * @see Db.table
 * @see InferTableScehma
 *
 * @public
 */
export class Table<Schema extends SomeRow = SomeRow> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #commands: CommandImpls<KeyOf<Schema>>;
  readonly #db: Db;

  /**
   * The name of the table. Unique per keyspace.
   */
  public readonly tableName!: string;

  /**
   * The keyspace that the table resides in.
   */
  public readonly keyspace!: string;

  /**
   * Use {@link Db.collection} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: TableSpawnOptions<Schema> | undefined) {
    Object.defineProperty(this, 'tableName', {
      value: name,
      writable: false,
    });

    Object.defineProperty(this, 'keyspace', {
      value: opts?.keyspace ?? db.keyspace,
      writable: false,
    });

    this.#httpClient = httpClient.forCollection(this.keyspace, this.tableName, opts);
    this.#httpClient.baseHeaders['Feature-Flag-tables'] = 'true';
    this.#commands = new CommandImpls(this.#httpClient, mkTableSerDes(opts?.serdes));
    this.#db = db;
  }

  public async insertOne(document: Schema[], options?: WithTimeout): Promise<TableInsertOneResult<Schema>> {
    return this.#commands.insertOne(document, options, constantly);
  }

  public async insertMany(document: Schema[], options?: TableInsertManyOptions): Promise<TableInsertManyResult<Schema>> {
    return this.#commands.insertMany(document, options, constantly);
  }

  public async updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: TableUpdateOneOptions): Promise<TableUpdateOneResult<Schema>> {
    return this.#commands.updateOne(filter, update, options);
  }

  public async updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: TableUpdateManyOptions): Promise<TableUpdateManyResult<Schema>> {
    return this.#commands.updateMany(filter, update, options);
  }

  public async deleteOne(filter: Filter<Schema>, options?: TableDeleteOneOptions): Promise<void> {
    await this.#commands.deleteOne(filter, options);
  }

  public async deleteMany(filter: Filter<Schema>, options?: WithTimeout): Promise<void> {
    void this.#commands.deleteMany(filter, options);
  }

  public find(filter: Filter<Schema>, options?: TableFindOptions): FindCursor<FoundRow<Schema>, FoundRow<Schema>> {
    return this.#commands.find(this.keyspace, filter, options);
  }

  public async findOne(filter: Filter<Schema>, options?: TableFindOneOptions): Promise<FoundRow<Schema> | null> {
    return this.#commands.findOne(filter, options);
  }

  public async countRows(filter: Filter<Schema>, upperBound: number, options?: WithTimeout): Promise<number> {
    return this.#commands.countDocuments(filter, upperBound, options);
  }

  public async drop(options?: WithTimeout): Promise<boolean> {
    return await this.#db.dropCollection(this.tableName, { keyspace: this.keyspace, ...options });
  }

  public async alter<const Spec extends AlterTableOptions<Schema>>(options: Spec): Promise<Table<AlterTableSchema<Schema, Spec>>>

  public async alter<NewSchema extends SomeRow>(options: AlterTableOptions<Schema>): Promise<Table<NewSchema>>

  public async alter(options: AlterTableOptions<Schema>): Promise<unknown> {
    const command = {
      alterTable: {
        name: this.tableName,
        operation: options.operation,
      },
    };

    await this.#db.command(command, { keyspace: this.keyspace, table: this.tableName, maxTimeMS: options.maxTimeMS });
    return this;
  }

  public async createIndex(name: string, column: Cols<Schema> | string, options?: CreateTableIndexOptions): Promise<void> {
    await this.#runDbCommand('addIndex', {
      name: name,
      column: column,
    }, options);
  }

  public async createTextIndex(name: string, column: Cols<Schema> | string, options?: CreateTableTextIndexOptions): Promise<void> {
    await this.#runDbCommand('addIndex', {
      name: name,
      column: column,
      options: { caseSensitive: options?.caseSensitive, normalize: options?.normalize, ascii: options?.ascii },
    }, options);
  }

  public async createVectorIndex(name: string, column: Cols<Schema> | string, options?: CreateTableVectorIndexOptions): Promise<void> {
    await this.#runDbCommand('addVectorIndex', {
      name: name,
      column: column,
      options: { similarityFunction: options?.similarityFunction, sourceModel: options?.sourceModel },
    }, options);
  }

  public async dropIndex(name: string, options?: WithTimeout): Promise<void> {
    await this.#runDbCommand('dropIndex', { name }, options);
  }

  async #runDbCommand(name: string, command: SomeDoc, timeout?: WithTimeout) {
    return await this.#db.command({ [name]: command }, { keyspace: this.keyspace, table: this.tableName, maxTimeMS: timeout?.maxTimeMS });
  }

  public get _httpClient() {
    return this.#httpClient;
  }
}
