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
  GenericFindAndRerankOptions,
  HybridSort,
  Projection,
  SomeDoc,
  SomeRow,
  Table,
} from '@/src/documents/index.js';
import { AbstractCursor } from '@/src/documents/cursors/abstract-cursor.js';
import type { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import type { SerializedFilter } from '@/src/documents/cursors/flc-internal.js';
import { FLCInternal } from '@/src/documents/cursors/flc-internal.js';
import type { RawDataAPIResponse } from '@/src/lib/index.js';

export interface FindAndRerankPage<T> {
  nextPageState: string | null,
  result: T[],
  sortVector?: DataAPIVector,
}

/**
 * ##### Overview
 *
 * Represents a single document returned from some generic `findAndRerank` operation on the Data API.
 * This is the individual item type emitted by a {@link FindAndRerankCursor}.
 *
 * Each result contains:
 * - the original document returned by the Data API (after projection), and
 * - an optional set of scores yielded during reranking (if `includeScores` was set on the cursor).
 *
 * ---
 *
 * ##### Reranking
 *
 * When hybrid search is performed using the `$hybrid` operator, the Data API returns candidate documents
 * based on vector and/or lexical similarity, before reranking them using a reranking model.
 *
 * If `includeScores` was enabled when the cursor was created, then the scores from each stage
 * of the ranking pipeline will be included in the `scores` object for every result.
 *
 * ---
 *
 * ##### Example
 *
 * ```ts
 * const cursor = collection.findAndRerank({}, {
 *   sort: { $hybrid: 'What is a tree?' },
 *   includeScores: true,
 * });
 *
 * for await (const result of cursor) {
 *   console.log(result.document); // The document
 *   console.log(result.scores);   // { $rerank: .12, $vector: .78, ... }
 * }
 * ```
 *
 * @see {@link FindAndRerankCursor}
 *
 * @public
 */
export class RerankedResult<TRaw> {
  /**
   * The document returned from the `findAndRerank` query.
   *
   * If a projection was applied, this will reflect only the projected fields.
   */
  public readonly document: TRaw;

  /**
   * The set of scores used during the hybrid search and reranking process.
   *
   * For collections, keys may include:
   * - `$vector`: the score from the vector similarity search
   * - `$lexical`: the score from the lexical similarity search
   * - `$reranker`: the score from the reranking step
   *
   * This will be an empty object unless `includeScores: true` was set on the cursor.
   */
  public readonly scores: Record<string, number>;

  public constructor(document: TRaw, scores: Record<string, number>) {
    this.document = document;
    this.scores = scores;
  }
}

/**
 * ##### Overview (preview)
 *
 * A lazy iterator over the results of some generic `findAndRerank` operation on the Data API.
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
 * In full, the cursor is typed as `FindAndRerankCursor<T, TRaw>`, where
 * - `T` is the type of the mapped records, and
 * - `TRaw` is the type of the raw records before any mapping.
 *
 * If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping is done using the {@link FindAndRerankCursor.map} method.
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
 * ```ts
 * const collection = db.collection('hybrid_coll');
 *
 * const cursor = collection.findAndRerank({}, {
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
 * @see CollectionFindAndRerankCursor
 *
 * @public
 */
export abstract class FindAndRerankCursor<T, TRaw extends SomeDoc = SomeDoc> extends AbstractCursor<T, RerankedResult<TRaw>> {
  /**
   * @internal
   */
  readonly _internal: FLCInternal<RerankedResult<TRaw>, FindAndRerankPage<RerankedResult<TRaw>>, GenericFindAndRerankOptions>;

  declare _currentPage?: FindAndRerankPage<RerankedResult<TRaw>>;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  public constructor(parent: Table<SomeRow> | Collection, serdes: SerDes, filter: SerializedFilter, options?: GenericFindAndRerankOptions, mapping?: (doc: TRaw) => T) {
    super(options ?? {}, mapping);
    this._internal = new FLCInternal(this, parent, serdes, filter, options);
  }

  /**
   * Should not be called directly.
   *
   * @internal
   */
  public [$CustomInspect](): string {
    return `${this.constructor.name}(source="${this._internal._parent.keyspace}.${this._internal._parent.name}",state="${this._state}",consumed=${this.consumed()},buffered=${this.buffered()})`;
  }
  /**
   * ##### Overview
   *
   * Returns the {@link Table}/{@link Collection} which spawned this cursor.
   *
   * @example
   * ```ts
   * const coll = db.collection(...);
   * const cursor = coll.findAndRerank(...);
   * cursor.dataSource === coll; // true
   * ```
   *
   * ---
   *
   * ##### Typing
   *
   * {@link CollectionFindAndRerankCursor} overrides this method to return the `dataSource` typed exactly as {@link Table} or {@link Collection} respectively, instead of remaining a union of both.
   */
  public abstract get dataSource(): Table<SomeRow> | Collection;

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
   * const cursor = table.findAndRerank({})
   *   .sort({ $hybrid: 'big burly man' })
   *   .filter({ name: 'John' });
   *
   * // The cursor will only return records with the name 'John'
   * const { document: john } = await cursor.next();
   * john.name === 'John'; // true
   * ```
   *
   * @param filter - A filter to select which records to return.
   *
   * @returns A new cursor with the new filter set.
   */
  public filter(filter: Filter): this {
    return this._internal.withFilter(filter);
  }

  /**
   * ##### Overview
   *
   * Sets the sort criteria for prioritizing records.
   *
   * > **🚨Important:** This option **must** be set, and **must** contain a `$hybrid` key.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `sort`.
   *
   * ---
   *
   * ##### The `$hybrid` key
   *
   * The `$hybrid` key is a special key that specifies the query(s) to use for the underlying vector and lexical searches.
   *
   * If your collection doesn't have vectorize enabled, you must pass separate query items for `$vector` and `$lexical`:
   * - `{ $hybrid: { $vector: vector([...]), $lexical: 'A house on a hill' } }`
   *
   * If your collection has vectorize enabled, you can query through the $vectorize field instead of the $vector field. You can also use a single search string for both the $vectorize and $lexical queries.
   * - `{ $hybrid: { $vectorize: 'A tree in the woods', $lexical: 'A house on a hill' } }`
   * - `{ $hybrid: 'A tree in the woods' }`
   *
   * ---
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John', age: 30, $vectorize: 'an elder man', $lexical: 'an elder man' },
   *   { name: 'Jane', age: 25, $vectorize: 'a young girl', $lexical: 'a young girl' },
   * ]);
   *
   * const cursor = collection.findAndRerank({})
   *   .sort({ $hybrid: 'old man' });
   *
   * // The cursor will return records sorted by the hybrid query
   * const { document: oldest } = await cursor.next();
   * oldest.nane === 'John'; // true
   * ```
   *
   * @param sort - The hybrid sort criteria to use for prioritizing records.
   *
   * @returns A new cursor with the new sort set.
   */
  public sort(sort: HybridSort): this {
    return this._internal.withSort(sort);
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
   *   { name: 'John', age: 30, $vectorize: 'an elder man', $lexical: 'an elder man' },
   *   { name: 'Jane', age: 25, $vectorize: 'a young girl', $lexical: 'a young girl' },
   * ]);
   *
   * const cursor = collection.findAndRerank({})
   *   .sort({ $hybrid: 'old man' })
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
    return this._internal.withOption('limit', limit || undefined);
  }

  /**
   * ##### Overview
   *
   * Sets the maximum number of records to consider from the underlying vector and lexical searches.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `limit`.
   *
   * ---
   *
   * ##### Different formats
   *
   * Either a single number, or an object may be provided as a limit definition.
   *
   * If a single number is specified, it applies to both the vector and lexical searches.
   *
   * To set different limits for the vector and lexical searches, an object containing limits for each vector and lexical column must be provided.
   * - For collections, it looks like this: `{ $vector: number, $lexical: number }`
   *
   * ---
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John', age: 30, $vectorize: 'an elder man', $lexical: 'an elder man' },
   *   { name: 'Jane', age: 25, $vectorize: 'a young girl', $lexical: 'a young girl' },
   * ]);
   *
   * const cursor = collection.findAndRerank({})
   *   .sort({ $hybrid: 'old man' })
   *   .hybridLimits(1);
   *
   * // The cursor will return only one record
   * const all = await cursor.toArray();
   * all.length === 1; // true
   * ```
   *
   * @param hybridLimits - The hybrid limits for this cursor.
   *
   * @returns A new cursor with the new hybrid limits set.
   */
  public hybridLimits(hybridLimits: number | Record<string, number>): this {
    return this._internal.withOption('hybridLimits', hybridLimits);
  }

  /**
   * ##### Overview
   *
   * Specifies the document field to use for the reranking step. Often used with {@link FindAndRerankCursor.rerankQuery}.
   *
   * Optional if you query through the `$vectorize` field instead of the `$vector` field; otherwise required.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `rerankOn`.
   *
   * ---
   *
   * ##### Under the hood
   *
   * Once the underlying vector and lexical searches complete, the reranker compares the `rerankQuery` text with each document's `rerankOn` field.
   *
   * The reserved `$lexical` field is often used for this parameter, but you can specify any field that stores a string.
   *
   * Any document lacking the field is excluded.
   *
   * ---
   *
   * @example
   * ```ts
   * const cursor = await coll.findAndRerank({})
   *   .sort({ $hybrid: { $vector: vector([...]), $lexical: 'what is a dog?' } })
   *   .rerankOn('$lexical')
   *   .rerankQuery('I like dogs');
   *
   * for await (const res of cursor) {
   *   console.log(res.document);
   * }
   * ```
   *
   * @param rerankOn - The document field to use for the reranking step.
   *
   * @returns A new cursor with the new rerankOn set.
   */
  public rerankOn(rerankOn: string): this {
    return this._internal.withOption('rerankOn', rerankOn);
  }

  /**
   * ##### Overview
   *
   * Specifies the query text to use for the reranking step. Often used with {@link FindAndRerankCursor.rerankOn}.
   *
   * Optional if you query through the `$vectorize` field instead of the `$vector` field; otherwise required.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with a new `rerankQuery`.
   *
   * ---
   *
   * ##### Under the hood
   *
   * Once the underlying vector and lexical searches complete, the reranker compares the `rerankQuery` text with each document's `rerankOn` field.
   *
   * ---
   *
   * @example
   * ```ts
   * const cursor = await coll.findAndRerank({})
   *   .sort({ $hybrid: { $vector: vector([...]), $lexical: 'what is a dog?' } })
   *   .rerankOn('$lexical')
   *   .rerankQuery('I like dogs');
   *
   * for await (const res of cursor) {
   *   console.log(res.document);
   * }
   * ```
   *
   * @param rerankQuery - The query text to use for the reranking step.
   *
   * @returns A new cursor with the new rerankQuery set.
   */
  public rerankQuery(rerankQuery: string): this {
    return this._internal.withOption('rerankQuery', rerankQuery);
  }

  /**
   * ##### Overview
   *
   * Determines whether the {@link RerankedResult.scores} is returned for each document.
   *
   * If this is not set, then the `scores` will be an empty object for each document.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with new score settings.
   *
   * @example
   * ```ts
   * const cursor = table.findAndRerank({ name: 'John' })
   *   .sort({ $hybrid: 'old man' })
   *   .includeScores();
   *
   * for await (const res of cursor) {
   *   console.log(res.document);
   *   console.log(res.scores);
   * }
   * ```
   *
   * @param includeScores - Whether the scores should be included in the result.
   *
   * @returns A new cursor with the new scores inclusion setting.
   */
  public includeScores(includeScores?: boolean): this {
    return this._internal.withOption('includeScores', includeScores ?? true);
  }

  /**
   * ##### Overview
   *
   * Sets whether the sort vector should be fetched on the very first API call.
   *
   * Note that this is a requirement
   * to use {@link FindAndRerankCursor.getSortVector}—it'll unconditionally return `null` if this is not set to `true`.
   * - See {@link FindAndRerankCursor.getSortVector} to see exactly what is returned when this is set to `true`.
   *
   * > **🚨Important:** This method does **NOT** mutate the cursor; it returns a new cursor with the new sort vector settings.
   *
   * @example
   * ```ts
   * const cursor = table.findAndRerank({})
   *   .sort({ $hybrid: 'old man' })
   *   .includeSortVector();
   *
   * // The cursor will return the sort vector used
   * // Here, it'll be the embedding for the vector created from the term 'old man'
   * const sortVector = await cursor.getSortVector();
   * sortVector; // DataAPIVector([...])
   * ```
   *
   * @param includeSortVector - Whether the sort vector should be fetched on the first API call
   *
   * @returns A new cursor with the new sort vector inclusion setting.
   */
  public includeSortVector(includeSortVector?: boolean): this {
    return this._internal.withOption('includeSortVector', includeSortVector ?? true);
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
   * const cursor = table.findAndRerank({ name: 'John' }).sort(...);
   *
   * // T is `RerankedResult<Partial<Schema>>` because the type is not specified
   * const rawProjected = cursor.project({ id: 0, name: 1 });
   *
   * // T is `RerankedResult<{ name: string }>`
   * const projected = cursor.project<{ name: string }>({ id: 0, name: 1 });
   *
   * // You can also chain instead of using intermediate variables
   * const fluentlyProjected = table
   *   .findAndRerank({ name: 'John' })
   *   .sort(...)
   *   .project<{ name: string }>({ id: 0, name: 1 });
   *   .map(res => res.document)
   *   .map(row => row.name);
   * ```
   *
   * @param projection - Specifies which fields should be included/excluded in the returned records.
   *
   * @returns A new cursor with the new projection set.
   */
  public project<RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection): FindAndRerankCursor<RerankedResult<RRaw>, RRaw> {
    return this._internal.withPreMapOption('projection', projection);
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
   * const cursor = table.findAndRerank({});
   *   .sort({ $hybrid: 'old man' })
   *   .map(res => res.document);
   *   .map(row => row.name.toLowerCase());
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
  public map<R>(map: (doc: T) => R): FindAndRerankCursor<R, TRaw> {
    return this._internal.withMap(map);
  }

  /**
   * ##### Overview
   *
   * Retrieves the vector used to perform the vector search, if applicable.
   *
   * > **🚨Important:** This will only return a non-null value if {@link FindAndRerankCursor.includeSortVector} is set.
   *
   * @example
   * ```ts
   * // Using $vector
   * const vector = new DataAPIVector([0.1, 0.2, 0.3]);
   * const cursor = collection.findAndRerank({})
   *   .sort({ $hybrid: { $vector: vector, ... } })
   *   .includeSortVector();
   *
   * const sortVector = await cursor.getSortVector();
   * // Returns the same vector used in the sort
   *
   * // Using $vectorize
   * const cursor = collection.findAndRerank({})
   *   .sort({ $hybrid: { $vectorize: 'some text', ... } })
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
   * - Return the original vector if `sort: { $hybrid: { $vector } }` was used
   * - Return the generated vector if `sort: { $hybrid: { $vectorize } }` was used
   *
   * If this method is called before the cursor has been executed, it will make an API request to fetch the sort vector and also populate the cursor's buffer.
   *
   * If the cursor has already been executed, the sort vector will have already been cached, so no additional request will be made.
   *
   * @returns The sort vector used to perform the vector search, or `null` if not applicable.
   */
  public async getSortVector(): Promise<DataAPIVector | null> {
    return this._internal.getSortVector();
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
   * const cursor = collection.findAndRerank({ age: { $gt: 30 } })
   *   .sort({ $hybrid: 'old man' });
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
   * See {@link FindAndRerankCursor.rewind} for more information on rewinding.
   *
   * @returns A new cursor with the same configuration as the current cursor.
   *
   * @see FindAndRerankCursor.rewind
   */
  public override clone(): this {
    return this._internal.cloneFLC();
  }

  /**
   * @internal
   */
  private static InternalNextPageOptions = <const>{
    commandName: 'findAndRerank',
    commandOptions: ['limit', 'hybridLimits', 'rerankOn', 'rerankQuery', 'includeScores', 'includeSortVector'],
    mapPage<TRaw extends SomeDoc>(page: FindAndRerankPage<SomeDoc>, raw: RawDataAPIResponse) {
      for (let i = 0, n = page.result.length; i < n; i++) {
        page.result[i] = new RerankedResult(page.result[i], raw.status?.documentResponses?.[i]?.scores ?? {});
      }

      return {
        nextPageState: page.nextPageState,
        result: page.result as TRaw[],
        sortVector: page.sortVector,
      };
    },
  };

  public async fetchNextPage(): Promise<FindAndRerankPage<T>> {
    return this._internal.fetchNextPageMapped(FindAndRerankCursor.InternalNextPageOptions);
  }

  /**
   * @internal
   */
  protected async _fetchNextPage(extra: Record<string, unknown>, tm: TimeoutManager | undefined): Promise<[FindAndRerankPage<RerankedResult<TRaw>>, boolean]> {
    return this._internal.fetchNextPageRaw(extra, tm, FindAndRerankCursor.InternalNextPageOptions);
  }

  /**
   * @internal
   */
  protected _tm(): Timeouts {
    return this._internal._httpClient.tm;
  }
}
