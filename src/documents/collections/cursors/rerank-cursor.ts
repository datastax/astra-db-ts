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

import type { Collection, CollectionFilter, Projection, RerankedResult, SomeDoc } from '@/src/documents/index.js';
import { FindAndRerankCursor } from '@/src/documents/index.js';

/**
 * ##### Overview (preview)
 *
 * A lazy iterator over the results of a `findAndRerank` operation on a {@link Collection}.
 *
 * > **⚠️Warning:** Shouldn't be directly instantiated, but rather spawned via {@link Collection.findAndRerank}.
 *
 * ---
 *
 * ##### Typing
 *
 * > **✏️Note:** You may generally treat the cursor as if it were typed as `FindAndRerankCursor<T>`.
 * >
 * > If you're using a projection, it is heavily recommended to provide an explicit type representing the type of the document after projection.
 *
 * In full, the cursor is typed as `CollectionFindAndRerankCursor<T, TRaw>`, where
 * - `T` is the type of the mapped records, and
 * - `TRaw` is the type of the raw records before any mapping.
 *
 * If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping is done using the {@link CollectionFindAndRerankCursor.map} method.
 *
 * ---
 *
 * ##### Options
 *
 * Options may be set either through the `findAndRerank({}, options)` method, or through the various fluent **builder
 * methods**, which, *unlike Mongo*, **do not mutate the existing cursor**, but rather return a new, uninitialized cursor
 * with the new option(s) set.
 *
 * @example
 * ```typescript
 * const collection = db.collection('hybrid_coll');
 *
 * const cursor: Cursor<Person> = collection.findAndRerank({}, {
 *   sort: { $hybrid: 'what is a car?' },
 *   includeScores: true,
 * });
 *
 * for await (const res of cursor) {
 *   console.log(res.document);
 *   console.log(res.scores);
 * }
 * ```
 *
 * @see Collection.findAndRerank
 * @see FindAndRerankCursor
 *
 * @public
 */
export class CollectionFindAndRerankCursor<T, TRaw extends SomeDoc = SomeDoc> extends FindAndRerankCursor<T, TRaw> {
  /**
   * ##### Overview
   *
   * Returns the {@link Collection} which spawned this cursor.
   *
   * @example
   * ```ts
   * const coll = db.collection(...);
   * const cursor = coll.findAndRerank(...);
   * cursor.dataSource === coll; // true
   * ```
   */
  public override get dataSource(): Collection  {
    return this._parent as Collection;
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
   * await collection.insertOne({ name: 'John', ... });
   *
   * const cursor = collection.findAndRerank({})
   *   .sort({ $hybrid: 'big burly man' })
   *   .filter({ name: 'John' });
   *
   * // The cursor will only return records with the name 'John'
   * const { document } = await cursor.next();
   * document.name === 'John'; // true
   * ```
   *
   * @param filter - A filter to select which records to return.
   *
   * @returns A new cursor with the new filter set.
   */
  public override filter(filter: CollectionFilter<TRaw>): this {
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
   * const cursor = collection.findAndRerank({ name: 'John' }).sort(...);
   *
   * // T is `RerankedResult<Partial<Schema>>` because the type is not specified
   * const rawProjected = cursor.project({ id: 0, name: 1 });
   *
   * // T is `RerankedResult<{ name: string }>`
   * const projected = cursor.project<{ name: string }>({ id: 0, name: 1 });
   *
   * // You can also chain instead of using intermediate variables
   * const fluentlyProjected = collection
   *   .findAndRerank({ name: 'John' })
   *   .sort(...)
   *   .project<{ name: string }>({ id: 0, name: 1 });
   *   .map(res => res.document)
   *   .map(doc => doc.name);
   * ```
   *
   * @param projection - Specifies which fields should be included/excluded in the returned records.
   *
   * @returns A new cursor with the new projection set.
   */
  declare public project: <RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection) => CollectionFindAndRerankCursor<RerankedResult<RRaw>, RRaw>;

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
   * const cursor = collection.findAndRerank({ name: 'John' })
   *   .sort({ $hybrid: 'old man' })
   *   .map(res => res.document.name);
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
  declare public map: <R>(map: (doc: T) => R) => CollectionFindAndRerankCursor<R, TRaw>;
}
