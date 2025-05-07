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
  Collection,
  DataAPIVector,
  Filter,
  GenericFindOptions,
  Projection,
  SomeDoc,
  SomeRow,
  Sort,
  Table,
  WithSim,
} from '@/src/documents/index.js';
import { vector } from '@/src/documents/datatypes/vector.js';
import { AbstractCursor } from '@/src/documents/cursors/abstract-cursor.js';
import type { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';
import { QueryState } from '@/src/lib/utils.js';
import type { SerializedFilter } from '@/src/documents/cursors/common.js';
import {
  buildFLCFilter,
  buildFLCMap,
  buildFLCOption,
  buildFLCPreMapOption,
  buildFLCSort,
  cloneFLC,
} from '@/src/documents/cursors/common.js';

/**
 * ##### Overview
 *
 * A lazy iterator over the results of some generic `find` operation on the Data API.
 *
 * > **⚠️Warning:** Shouldn't be directly instantiated, but rather spawned via {@link Table.find}/{@link Collection.find}.
 *
 * ---
 *
 * ##### Typing
 *
 * > **✏️Note:** You may generally treat the cursor as if it were typed simply as `FindCursor<T>`.
 * >
 * > If you're using a projection, it is heavily recommended to provide an explicit type representing the type of the document after projection.
 *
 * In full, the cursor is typed as `FindCursor<T, TRaw>`, where
 * - `T` is the type of the mapped records, and
 * - `TRaw` is the type of the raw records before any mapping.
 *
 * If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping is done using the {@link FindCursor.map} method.
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
 * ```ts
 * interface Person {
 *   firstName: string,
 *   lastName: string,
 *   age: number,
 * }
 *
 * // cursor1 is of type CollectionFindCursor<Person> here
 * const collection = db.collection<Person>('people');
 * const cursor1 = collection.find({ firstName: 'John' });
 *
 * // Lazily iterate all documents matching the filter
 * for await (const doc of cursor1) {
 *   console.log(doc);
 * }
 *
 * // Rewind the cursor to be able to iterate again
 * cursor1.rewind();
 *
 * // Get all documents matching the filter as an array
 * const docs = await cursor1.toArray();
 *
 * // Immutably set options & map as needed
 * // (changing options returns a new, uninitialized cursor)
 * // cursor2 is of type CollectionFindCursor<string> here
 * const cursor2 = cursor
 *   .project<Omit<Person, 'age'>>({ age: 0 })
 *   .map(doc => doc.firstName + ' ' + doc.lastName);
 *
 * // Get next document from cursor
 * const doc = await cursor2.next();
 * ```
 *
 * @see CollectionFindCursor
 * @see TableFindCursor
 *
 * @public
 */
export abstract class FindCursor<T, TRaw extends SomeDoc = SomeDoc> extends AbstractCursor<T, TRaw> {
  /**
   * @internal
   */
  private readonly _httpClient: DataAPIHttpClient;

  /**
   * @internal
   */
  readonly _serdes: SerDes;

  /**
   * @internal
   */
  readonly _parent: Table<SomeRow> | Collection;

  /**
   * @internal
   */
  declare readonly _options: GenericFindOptions;

  /**
   * @internal
   */
  readonly _filter: SerializedFilter;

  /**
   * @internal
   */
  private _sortVector = new QueryState<DataAPIVector>();

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  public constructor(parent: Table<SomeRow> | Collection, serdes: SerDes, filter: SerializedFilter, options?: GenericFindOptions, mapping?: (doc: TRaw) => T) {
    super(options ?? {}, mapping);
    this._parent = parent;
    this._httpClient = parent._httpClient;
    this._serdes = serdes;
    this._filter = filter;
  }

  /**
   * Should not be called directly.
   *
   * @internal
   */
  public [$CustomInspect](): string {
    return `${this.constructor.name}(source="${this._parent.keyspace}.${this._parent.name}",state="${this._state}",consumed=${this.consumed()},buffered=${this.buffered()})`;
  }

  /**
   * ##### Overview
   *
   * Returns the {@link Table}/{@link Collection} which spawned this cursor.
   *
   * @example
   * ```ts
   * const coll = db.collection(...);
   * const cursor = coll.find({});
   * cursor.dataSource === coll; // true
   * ```
   *
   * ---
   *
   * ##### Typing
   *
   * {@link TableFindCursor} & {@link CollectionFindCursor} override this method to return the `dataSource` typed exactly as {@link Table} or {@link Collection} respectively, instead of remaining a union of both.
   */
  public abstract get dataSource(): Table<SomeRow> | Collection

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
  public filter(filter: Filter): this {
    return buildFLCFilter(this, filter);
  }

  /**
   * ##### Overview
   *
   * Sets the sort criteria for prioritizing records.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `sort`.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John', age: 30 },
   *   { name: 'Jane', age: 25 },
   * ]);
   *
   * const cursor = collection.find({})
   *  .sort({ age: -1 });
   *
   * // The cursor will return records sorted by age in descending order
   * const oldest = await cursor.next();
   * oldest.age === 30; // true
   * ```
   *
   * @param sort - The sort order to prioritize which records are returned.
   *
   * @returns A new cursor with the new sort set.
   */
  public sort(sort: Sort): this {
    return buildFLCSort(this, sort);
  }

  /**
   * ##### Overview
   *
   * Sets the maximum number of records to return.
   *
   * If `limit == 0`, there will be **no limit** on the number of records returned (beyond any that the Data API may itself enforce).
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `limit`.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John', age: 30 },
   *   { name: 'Jane', age: 25 },
   * ]);
   *
   * const cursor = collection.find({})
   *   .limit(1);
   *
   * // The cursor will return only one record
   * const all = await cursor.toArray();
   * all.length === 1; // true
   * ```
   *
   * @param limit - The limit for this cursor.
   *
   * @returns A new cursor with the new limit set.
   */
  public limit(limit: number): this {
    return buildFLCOption(this, 'limit', limit || undefined);
  }

  /**
   * ##### Overview
   *
   * Sets the number of records to skip before returning. **Must be used with {@link FindCursor.sort}.**
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `skip`.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John', age: 30 },
   *   { name: 'Jane', age: 25 },
   * ]);
   *
   * const cursor = collection.find({})
   *   .sort({ age: -1 })
   *   .skip(1);
   *
   * // The cursor will skip the first record and return the second
   * const secondOldest = await cursor.next();
   * secondOldest.age === 25; // true
   * ```
   *
   * @param skip - The skip for the cursor query.
   *
   * @returns A new cursor with the new skip set.
   */
  public skip(skip: number): this {
    return buildFLCOption(this, 'skip', skip);
  }

  /**
   * ##### Overview
   *
   * Sets whether the sort vector should be fetched on the very first API call.
   *
   * This is a requirement to use {@link FindCursor.getSortVector}, which will unconditionally return `null` if this is not set to `true`.
   * - See {@link FindCursor.getSortVector} to see exactly what is returned when this is set to `true`.
   *
   * > **✏️Note:** This is only applicable when using vector search, and is ignored otherwise.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with the new sort vector settings.
   *
   * @example
   * ```ts
   * const cursor = table.find({ name: 'John' })
   *   .sort({ $vectorize: 'name' })
   *   .includeSortVector();
   *
   * // The cursor will return the sort vector used
   * // Here, it'll be the embedding for the vector created from the name 'John'
   * const sortVector = await cursor.getSortVector();
   * sortVector; // DataAPIVector([...])
   * ```
   *
   * @param includeSortVector - Whether the sort vector should be fetched on the first API call
   *
   * @returns A new cursor with the new sort vector inclusion setting.
   */
  public includeSortVector(includeSortVector?: boolean): this {
    return buildFLCOption(this, 'includeSortVector', includeSortVector ?? true);
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
  public project<RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection): FindCursor<RRaw, RRaw> {
    return buildFLCPreMapOption(this, 'projection', structuredClone(projection));
  }

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
  public includeSimilarity(includeSimilarity?: boolean): FindCursor<WithSim<TRaw>, WithSim<TRaw>> {
    return buildFLCPreMapOption(this, 'includeSimilarity', includeSimilarity ?? true);
  }

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
  public map<R>(map: (doc: T) => R): FindCursor<R, TRaw> {
    return buildFLCMap(this, map);
  }

  /**
   * ##### Overview
   *
   * Retrieves the vector used to perform the vector search, if applicable.
   *
   * > **🚨Important:** This will only return a non-null value if {@link FindCursor.includeSortVector} has been set.
   *
   * @example
   * ```ts
   * // Using $vector
   * const vector = new DataAPIVector([0.1, 0.2, 0.3]);
   * const cursor = collection.find({})
   *   .sort({ $vector: vector })
   *   .includeSortVector();
   *
   * const sortVector = await cursor.getSortVector();
   * // Returns the same vector used in the sort
   *
   * // Using $vectorize
   * const cursor = collection.find({})
   *   .sort({ $vectorize: 'some text' })
   *   .includeSortVector();
   *
   * const sortVector = await cursor.getSortVector();
   * // Returns the vector generated from the text
   * ```
   *
   * ---
   *
   * ##### Method Behavior
   *
   * This method will:
   * - Return `null` if `includeSortVector` was not set to `true`
   * - Return the original vector if `sort: { $vector }` was used
   * - Return the generated vector if `sort: { $vectorize }` was used
   * - Return `null` if vector search was not used
   *
   * If this method is called before the cursor has been executed, it will make an API request to fetch the sort vector and also populate the cursor's buffer.
   *
   * If the cursor has already been executed, the sort vector will have already been cached, so no additional request will be made.
   *
   * @returns The sort vector used to perform the vector search, or `null` if not applicable.
   */
  public async getSortVector(): Promise<DataAPIVector | null> {
    if (this._sortVector.state === QueryState.Unattempted && this._options.includeSortVector) {
      await this._next(true, '.getSortVector');
    }

    return this._sortVector.unwrap();
  }

  /**
   * ##### Overview
   *
   * Creates a new cursor with the exact same configuration as the current cursor.
   *
   * The new cursor will be in the `'idle'` state, regardless of the state of the current cursor, and will start its own iteration from the beginning, sending new queries to the server, even if the resultant data was already fetched by the original cursor.
   *
   * @example
   * ```ts
   * const cursor = collection.find({ age: { $gt: 30 } }).sort({ name: 1 });
   *
   * // Clone the cursor before use
   * const clone1 = cursor.clone();
   * const clone2 = cursor.clone();
   *
   * // Each cursor operates independently
   * const firstResult = await clone1.toArray();
   * const firstTwoRecords = await clone2.next();
   *
   * // Original cursor is still usable
   * for await (const doc of cursor) {
   *   console.log(doc);
   * }
   * ```
   *
   * ---
   *
   * ##### Cloning vs Rewinding
   *
   * Cloning a cursor is different from rewinding it. Cloning creates an independent new cursor with the same configuration as the original, while rewinding resets the current cursor to its initial state.
   *
   * See {@link FindCursor.rewind} for more information on rewinding.
   *
   * @returns A new cursor with the same configuration as the current cursor.
   *
   * @see FindCursor.rewind
   */
  public override clone(): this {
    return cloneFLC(this, this._filter, this._options, this._mapping);
  }

  /**
   * @internal
   */
  protected async _nextPage(extra: Record<string, unknown>, tm: TimeoutManager | undefined): Promise<TRaw[]> {
    const command = {
      find: {
        filter: this._filter[0],
        projection: this._options.projection,
        sort: this._options.sort,
        options: {
          includeSimilarity: this._options.includeSimilarity,
          includeSortVector: this._options.includeSortVector,
          limit: this._options.limit,
          skip: this._options.skip,
          pageState: this._nextPageState.unwrap(),
        },
      },
    };

    const raw = await this._httpClient.executeCommand(command, {
      timeoutManager: tm ?? this._httpClient.tm.single('generalMethodTimeoutMs', this._options),
      bigNumsPresent: this._filter[1],
      extraLogInfo: extra,
    });

    this._nextPageState.swap(raw.data?.nextPageState);

    /* c8 ignore next: don't think it's possible for documents to be nullish, but just in case */
    const buffer = raw.data?.documents ?? [];

    for (let i = 0, n = buffer.length; i < n; i++) {
      buffer[i] = this._serdes.deserialize(buffer[i], raw, SerDesTarget.Record);
    }

    const sortVector = raw.status?.sortVector;
    this._sortVector.swap(sortVector ? vector(sortVector) : sortVector);
    this._options.includeSortVector = false;

    return buffer;
  }

  /**
   * @internal
   */
  protected _tm(): Timeouts {
    return this._httpClient.tm;
  }
}
