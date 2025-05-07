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

import type { Projection, SomeRow, Table, TableFilter, WithSim } from '@/src/documents/index.js';
import { FindCursor } from '@/src/documents/cursors/find-cursor.js';

/**
 * ##### Overview
 *
 * A lazy iterator over the results of a `find` operation on a {@link Table}.
 *
 * > **⚠️Warning:** Shouldn't be directly instantiated, but rather spawned via {@link Table.find}.
 *
 * ---
 *
 * ##### Typing
 *
 * > **✏️Note:** You may generally treat the cursor as if it were typed simply as `TableFindCursor<T>`.
 * >
 * > If you're using a projection, it is heavily recommended to provide an explicit type representing the type of the document after projection.
 *
 * In full, the cursor is typed as `TableFindCursor<T, TRaw>`, where
 * - `T` is the type of the mapped records, and
 * - `TRaw` is the type of the raw records before any mapping.
 *
 * If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping is done using the {@link TableFindCursor.map} method.
 *
 * ---
 *
 * ##### Options
 *
 * Options may be set either through the `find({}, options)` method, or through the various fluent **builder
 * methods**, which, *unlike Mongo*, **do not mutate the existing cursor**, but rather return a new, uninitialized cursor
 * with the new option(s) set.
 *
 * @example
 * ```typescript
 * interface Person {
 *   firstName: string,
 *   lastName: string,
 *   age: number,
 * }
 *
 * const table = db.table<Person>('people');
 * const cursor1: Cursor<Person> = table.find({ firstName: 'John' });
 *
 * // Lazily iterate all rows matching the filter
 * for await (const row of cursor1) {
 *   console.log(row);
 * }
 *
 * // Rewind the cursor to be able to iterate again
 * cursor1.rewind();
 *
 * // Get all rows matching the filter as an array
 * const rows = await cursor1.toArray();
 *
 * // Immutably set options & map as needed (changing options returns a new, uninitialized cursor)
 * const cursor2: Cursor<string> = cursor
 *   .project<Omit<Person, 'age'>>({ age: 0 })
 *   .map(row => row.firstName + ' ' + row.lastName);
 *
 * // Get next row from cursor
 * const row = await cursor2.next();
 * ```
 *
 * @see Table.findCursor
 * @see FindCursor
 *
 * @public
 */
export class TableFindCursor<T, TRaw extends SomeRow = SomeRow> extends FindCursor<T, TRaw> {
  /**
   * ##### Overview
   *
   * Returns the {@link Table} which spawned this cursor.
   *
   * @example
   * ```ts
   * const table = db.table(...);
   * const cursor = coll.find({});
   * cursor.dataSource === table; // true
   * ```
   */
  public get dataSource(): Table<SomeRow> {
    return this._parent as Table<SomeRow>;
  }

  /**
   * ##### Overview
   *
   * Sets the filter for the cursor, overwriting any previous filter.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `filter`.
   *
   * @example
   * ```ts
   * await table.insertOne({ name: 'John', ... });
   *
   * const cursor = table.find({})
   *   .filter({ name: 'John' });
   *
   * // The cursor will only return records with the name 'John'
   * const john = await cursor.next();
   * john.name === 'John'; // true
   * ```
   *
   * @param filter - A filter to select which records to return.
   *
   * @returns A new cursor with the new filter set.
   */
  public override filter(filter: TableFilter<TRaw>): this {
    return super.filter(filter);
  }

  /**
   * ##### Overview
   *
   * Sets the projection for the cursor, overwriting any previous projection.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new projection.
   *
   * > **🚨Important:** To properly type this method, you should provide a type argument to specify the shape of the projected
   * records.
   *
   * > **⚠️Warning:** You may *NOT* provide a projection after a mapping is already provided, to prevent potential type de-sync errors.
   *
   * @example
   * ```ts
   * const cursor = table.find({ name: 'John' });
   *
   * // T is `Partial<Schema>` because the type is not specified
   * const rawProjected = cursor.project({ id: 0, name: 1 });
   *
   * // T is `{ name: string }`
   * const projected = cursor.project<{ name: string }>({ id: 0, name: 1 });
   *
   * // You can also chain instead of using intermediate variables
   * const fluentlyProjected = table
   *   .find({ name: 'John' })
   *   .project<{ name: string }>({ id: 0, name: 1 })
   *   .map(row => row.name);
   * ```
   *
   * @param projection - Specifies which fields should be included/excluded in the returned records.
   *
   * @returns A new cursor with the new projection set.
   */
  declare public project: <RRaw extends SomeRow = Partial<TRaw>>(projection: Projection) => TableFindCursor<RRaw, RRaw>;

  /**
   * ##### Overview
   *
   * Sets whether vector similarity scores should be included in the cursor's results.
   *
   * > **✏️Note:** This is only applicable when using vector search, and is ignored otherwise.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with the new similarity settings.
   *
   * @example
   * ```ts
   * const cursor = table.find({ name: 'John' })
   *   .sort({ $vector: new DataAPIVector([...]) })
   *   .includeSimilarity();
   *
   * // The cursor will return the similarity scores for each record
   * const closest = await cursor.next();
   * closest.$similarity; // number
   * ```
   *
   * @param includeSimilarity - Whether similarity scores should be included.
   *
   * @returns A new cursor with the new similarity setting.
   */
  declare public includeSimilarity: (includeSimilarity?: boolean) => TableFindCursor<WithSim<TRaw>, WithSim<TRaw>>;

  /**
   * ##### Overview
   *
   * Map all records using the provided mapping function. Previous mapping functions will be composed with the new
   * mapping function (new ∘ old).
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with the new mapping function applied.
   *
   * > **⚠️Warning:** You may *NOT* provide a projection after a mapping is already provided, to prevent potential type de-sync errors.
   *
   * @example
   * ```ts
   * const cursor = table.find({ name: 'John' })
   *   .map(row => row.name);
   *   .map(name => name.toLowerCase());
   *
   * // T is `string` because the mapping function returns a string
   * const name = await cursor.next();
   * name === 'john'; // true
   * ```
   *
   * @param map - The mapping function to apply to all records.
   *
   * @returns A new cursor with the new mapping set.
   */
  declare public map: <R>(map: (doc: T) => R) => TableFindCursor<R, TRaw>;
}
