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
import { vector } from '@/src/documents/index.js';
import { AbstractCursor } from '@/src/documents/cursors/abstract-cursor.js';
import type { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';
import type { SerializedFilter } from '@/src/documents/cursors/common.js';
import {
  buildFLCFilter,
  buildFLCMap,
  buildFLCOption,
  buildFLCPreMapOption,
  buildFLCSort,
  cloneFLC,
} from '@/src/documents/cursors/common.js';
import { QueryState } from '@/src/lib/utils.js';

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
 * @see CollectionFindAndRerankCursor
 *
 * @public
 */
export abstract class FindAndRerankCursor<T, TRaw extends SomeDoc = SomeDoc> extends AbstractCursor<T, RerankedResult<TRaw>> {
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
  declare readonly _options: GenericFindAndRerankOptions;

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
  public constructor(parent: Table<SomeRow> | Collection, serdes: SerDes, filter: SerializedFilter, options?: GenericFindAndRerankOptions, mapping?: (doc: TRaw) => T) {
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
  public filter(filter: Filter): this {
    return buildFLCFilter(this, filter);
  }

  /**
   * ##### Overview
   *
   * Sets the sort criteria for prioritizing records.
   *
   * This option **must** be set, and **must** contain a `$hybrid` key.
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new sort set.*
   *
   * ---
   *
   * ##### The `$hybrid` key
   *
   * The `$hybrid` key is a special key that specifies the query(s) to use for the underlying vector and lexical searches.
   *
   * If your collection doesn’t have vectorize enabled, you must pass separate query items for `$vector` and `$lexical`:
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
   * const cursor = collection.find({})
   *   .sort({ $hybrid: 'old man' });
   *
   * // The cursor will return records sorted by the hybrid query
   * const oldest = await cursor.next();
   * oldest.nane === 'John'; // true
   * ```
   *
   * @param sort - The hybrid sort criteria to use for prioritizing records.
   *
   * @returns A new cursor with the new sort set.
   */
  public sort(sort: HybridSort): this {
    return buildFLCSort(this, sort);
  }

  /**
   * ##### Overview
   *
   * Sets the maximum number of records to return.
   *
   * If `limit == 0`, there will be **no limit** on the number of records returned (beyond any that the Data API may itself enforce).
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new limit set.*
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John', age: 30, $vectorize: 'an elder man', $lexical: 'an elder man' },
   *   { name: 'Jane', age: 25, $vectorize: 'a young girl', $lexical: 'a young girl' },
   * ]);
   *
   * const cursor = collection.find({})
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
    return buildFLCOption(this, 'limit', limit || undefined);
  }

  /**
   * ##### Overview
   *
   * Sets the maximum number of records to consider from the underlying vector and lexical searches.
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new limit set.*
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
   * const cursor = collection.find({})
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
    return buildFLCOption(this, 'hybridLimits', hybridLimits);
  }

  /**
   * ##### Overview
   *
   * Specifies the document field to use for the reranking step. Often used with {@link FindAndRerankCursor.rerankQuery}.
   *
   * Optional if you query through the `$vectorize` field instead of the `$vector` field; otherwise required.
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new setting.*
   *
   * ---
   *
   * ##### Under the hood
   *
   * Once the underlying vector and lexical searches complete, the reranker compares the `rerankQuery` text with each document’s `rerankOn` field.
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
    return buildFLCOption(this, 'rerankOn', rerankOn);
  }

  /**
   * ##### Overview
   *
   * Specifies the query text to use for the reranking step. Often used with {@link FindAndRerankCursor.rerankOn}.
   *
   * Optional if you query through the `$vectorize` field instead of the `$vector` field; otherwise required.
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new setting.*
   *
   * ---
   *
   * ##### Under the hood
   *
   * Once the underlying vector and lexical searches complete, the reranker compares the `rerankQuery` text with each document’s `rerankOn` field.
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
    return buildFLCOption(this, 'rerankQuery', rerankQuery);
  }

  /**
   * ##### Overview
   *
   * Determines whether the {@link RerankedResult.scores} is returned for each document.
   *
   * If this is not set, then the `scores` will be an empty object for each document.
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new setting.*
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
    return buildFLCOption(this, 'includeScores', includeScores ?? true);
  }

  /**
   * ##### Overview
   *
   * Sets whether the sort vector should be fetched on the very first API call. Note that this is a requirement
   * to use {@link FindAndRerankCursor.getSortVector}—it'll unconditionally return `null` if this is not set to `true`.
   * - This is only applicable when using vector search, and will be ignored if the cursor is not using vector search.
   * - See {@link FindAndRerankCursor.getSortVector} to see exactly what is returned when this is set to `true`.
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new setting.*
   *
   * @example
   * ```ts
   * const cursor = table.findAndRerank({)
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
    return buildFLCOption(this, 'includeSortVector', includeSortVector ?? true);
  }

  /**
   * Sets the projection for the cursor, overwriting any previous projection.
   *
   * *Note: this method does **NOT** mutate the cursor; it simply
   * returns a new, uninitialized cursor with the given new projection set.*
   *
   * **To properly type this method, you should provide a type argument to specify the shape of the projected
   * records.**
   *
   * **Note that you may NOT provide a projection after a mapping is already provided, to prevent potential
   * de-sync errors.** If you really want to do so, you may use {@link FindAndRerankCursor.clone} to create a new cursor
   * with the same configuration, but without the mapping, and then set the projection.
   *
   * @example
   * ```typescript
   * const cursor = table.findAndRerank({ name: 'John' }).sort(...);
   *
   * // T is `any` because the type is not specified
   * const rawProjected = cursor.project({ id: 0, name: 1 });
   *
   * // T is { name: string }
   * const projected = cursor.project<{ name: string }>({ id: 0, name: 1 });
   *
   * // You can also chain instead of using intermediate variables
   * const fluentlyProjected = table
   *   .findAndRerank({ name: 'John' })
   *   .sort(...)
   *   .project<{ name: string }>({ id: 0, name: 1 });
   *
   * // It's important to keep mapping in mind
   * const mapProjected = table
   *   .findAndRerank({ name: 'John' })
   *   .sort(...)
   *   .map(doc => doc.name);
   *   .project<string>({ id: 0, name: 1 });
   * ```
   *
   * @param projection - Specifies which fields should be included/excluded in the returned records.
   *
   * @returns A new cursor with the new projection set.
   */
  public project<RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection): FindAndRerankCursor<RerankedResult<RRaw>, RRaw> {
    return buildFLCPreMapOption(this, 'projection', projection);
  }

  /**
   * ##### Overview
   *
   * Map all records using the provided mapping function. Previous mapping functions will be composed with the new
   * mapping function (new ∘ old).
   *
   * *Note: this method does **NOT** mutate the cursor; it simply returns a new, uninitialized cursor with the given new projection set.*
   *
   * **You may NOT set a projection after a mapping is already provided, to prevent potential de-sync errors.**
   *
   * @example
   * ```ts
   * const cursor = table.findAndRerank({});
   *   .sort({ $hybrid: 'old man' })
   *   .map(res => res.document);
   *   .map(doc => doc.name.toLowerCase());
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
    return buildFLCMap(this, map);
  }

  /**
   * ##### Overview
   *
   * Retrieves the vector used to perform the vector search, if applicable.
   *
   * - If `includeSortVector` is not `true`, this will unconditionally return `null`. No find request will be made.
   *
   * - If `sort: { $hybrid: { $vector } }` was used, `getSortVector()` will simply regurgitate that same `$vector`.
   *
   * - If `sort: { $hybrid: { $vectorize } }` was used, `getSortVector()` will return the `$vector` that was created from the text.
   *
   * - If vector search is not used, `getSortVector()` will simply return `null`. A find request will still be made.
   *
   * If `includeSortVector` is `true`, and this function is called before any other cursor operation (such as
   * `.next()` or `.toArray()`), it'll make an API request to fetch the sort vector, filling the cursor's buffer
   * in the process.
   *
   * If the cursor has already been executed before this function has been called, no additional API request
   * will be made to fetch the sort vector, as it has already been cached.
   *
   * But to reiterate, if `includeSortVector` is `false`, and this function is called, no API request is made, and
   * the cursor's buffer is not populated; it simply returns `null`.
   *
   * @returns The sort vector, or `null` if none was used (or if `includeSortVector !== true`).
   */
  public async getSortVector(): Promise<DataAPIVector | null> {
    if (this._sortVector.state === QueryState.Unattempted && this._options.includeSortVector) {
      const reset2idle = this._state === 'idle';

      await this._next(true, '.getSortVector');

      if (reset2idle) {
        this._state = 'idle';
      }
    }

    return this._sortVector.unwrap();
  }

  /**
   * ##### Overview
   *
   * Creates, a new, uninitialized copy of this cursor with the exact same options and mapping.
   *
   * See {@link FindAndRerankCursor.rewind} for resetting the same instance of the cursor.
   */
  public override clone(): this {
    return cloneFLC(this, this._filter, this._options, this._mapping);
  }

  /**
   * @internal
   */
  protected async _nextPage(extra: Record<string, unknown>, tm: TimeoutManager | undefined): Promise<RerankedResult<TRaw>[]> {
    const command = {
      findAndRerank: {
        filter: this._filter[0],
        projection: this._options.projection,
        sort: this._options.sort,
        options: {
          limit: this._options.limit,
          hybridLimits: this._options.hybridLimits,
          rerankOn: this._options.rerankOn,
          rerankQuery: this._options.rerankQuery,
          includeScores: this._options.includeScores,
          includeSortVector: this._options.includeSortVector,
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
      const deserialized = this._serdes.deserialize(buffer[i], raw, SerDesTarget.Record);
      buffer[i] = new RerankedResult(deserialized, raw.status?.documentResponses?.[i]?.scores ?? {});
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
