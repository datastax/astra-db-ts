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

/**
 * ##### Overview
 *
 * Represents *some primary key* in a table. This is a generic type that represents some (any) table primary key with any number & types
 * of columns. All it asks for is that the primary key be an object with string keys and any values.
 *
 * Keep in mind the logical constraints, however:
 * - This should be a subset of the table's schema
 * - Primary key values must be only scalar types
 *
 * > **✏️Note:** There is no distinction between partition and clustering keys in this type.
 *
 * ---
 *
 * ##### Constructing this type
 *
 * Often, you may want to construct this type using the {@link Pick} utility type, to select only the fields of the schema which are in the primary key.
 *
 * @example
 * ```ts
 * interface MyTableSchema {
 *   partitionKey: string;
 *   clusteringKey: number;
 *   otherField: Map<string, string>;
 * }
 *
 * type MyTablePrimaryKey = Pick<MyTableSchema, 'partitionKey' | 'clusteringKey'>;
 *
 * const table = db.table<MyTableSchema, MyTablePrimaryKey>('my_table');
 * ```
 *
 * However, if you are constructing a table with {@link Db.createTable}, you may use the {@link InferTablePrimaryKey} utility type to infer the TS-equivalent type of the primary key from the {@link CreateTableDefinition}.
 *
 * @example
 * ```ts
 * const MyTableSchema = Table.schema({
 *   columns: {
 *     partitionKey: 'text',
 *     clusteringKey: 'int',
 *     otherField: 'map<text, text>',
 *   },
 *   primaryKey: {
 *     partitionBy: ['partitionKey'],
 *     partitionSort: { clusteringKey: 1 },
 *   },
 * });
 *
 * type MyTableSchema = typeof MyTableSchema;
 * type MyTablePrimaryKey = InferTablePrimaryKey<typeof MyTableSchema>;
 *
 * const table = db.createTable<MyTableSchema, MyTablePrimaryKey>('my_table', {
 *   definition: MyTableSchema,
 * });
 * ```
 *
 * ##### Using this type
 *
 * This type is used as the second type parameter of the {@link Table} class.
 *
 * If this is not provided, then the table's primary key type will default to `Partial<Schema>` where `Schema` is the schema of the table.
 *
 * @see InferTablePrimaryKey
 * @see Db.createTable
 * @see SomeRow
 * @see Table
 */
export type SomePKey = Record<string, any>;

/**
 * Checks if a type can possibly be some number
 *
 * @example
 * ```typescript
 * IsNum<string | number> === true
 * ```
 *
 * @public
 */
export type IsNum<T> = number extends T ? true : bigint extends T ? true : false

/**
 * Checks if a type can possibly be a date
 *
 * @example
 * ```typescript
 * IsDate<string | Date> === boolean
 * ```
 *
 * @public
 */
export type IsDate<T> = IsAny<T> extends true ? true : T extends Date | { $date: number } ? true : false

/**
 * Checks if a type is any
 *
 * @public
 */
export type IsAny<T> = true extends false & T ? true : false
