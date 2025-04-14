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
 * > **⚠️Warning**: Shouldn't be directly instantiated, but rather spawned via {@link Collection.findAndRerank}.
 *
 * ---
 *
 * ##### Typing
 *
 * > **🚨Important:** For most intents and purposes, you may treat the cursor as if it is typed simply as `Cursor<T>`.
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
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new filter set.*
   *
   * @example
   * ```ts
   * await table.insertOne({ name: 'John', ... });
   *
   * const cursor = table.findAndRerank({})
   *   .sort({ $hybrid: 'big burly man' })
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
  public override filter(filter: CollectionFilter<TRaw>): this {
    return super.filter(filter);
  }

  declare public project: <RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection) => CollectionFindAndRerankCursor<RerankedResult<RRaw>, RRaw>;

  declare public map: <R>(map: (doc: T) => R) => CollectionFindAndRerankCursor<R, TRaw>;
}
