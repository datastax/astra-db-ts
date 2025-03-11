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
import { CursorError, vector } from '@/src/documents/index.js';
import { AbstractCursor } from '@/src/documents/cursors/abstract-cursor.js';
import type { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';
import { QueryState } from '@/src/lib/utils.js';

/**
 * @internal
 */
type SerializedFilter = [filter: unknown, bigNumsPresent: boolean];

export abstract class FindCursor<T, TRaw extends SomeDoc = SomeDoc> extends AbstractCursor<T, TRaw> {
  /**
   * @internal
   */
  private readonly _httpClient: DataAPIHttpClient;

  /**
   * @internal
   */
  private readonly _serdes: SerDes;

  /**
   * @internal
   */
  private readonly _parent: Table<SomeRow> | Collection;

  /**
   * @internal
   */
  declare protected readonly _options: GenericFindOptions;

  /**
   * @internal
   */
  private readonly _filter: SerializedFilter;

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
   * The table/collection which spawned this cursor.
   *
   * @returns The table/collection which spawned this cursor.
   */
  public get dataSource(): Table<SomeRow> | Collection {
    return this._parent;
  }

  /**
   * Sets the filter for the cursor, overwriting any previous filter.
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new filter set.*
   *
   * @param filter - A filter to select which records to return.
   *
   * @returns A new cursor with the new filter set.
   */
  public filter(filter: Filter): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new filter on a running/closed cursor', this);
    }
    return this._clone(this._serdes.serialize(structuredClone(filter), SerDesTarget.Filter), this._options, this._mapping);
  }

  /**
   * Sets the sort criteria for prioritizing records.
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new sort set.*
   *
   * @param sort - The sort order to prioritize which records are returned.
   *
   * @returns A new cursor with the new sort set.
   */
  public sort(sort: Sort): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new sort on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, sort }, this._mapping);
  }

  /**
   * Sets the maximum number of records to return.
   *
   * If `limit == 0`, there will be no limit on the number of records returned.
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new limit set.*
   *
   * @param limit - The limit for this cursor.
   *
   * @returns A new cursor with the new limit set.
   */
  public limit(limit: number): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new limit on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, limit: limit || Infinity }, this._mapping);
  }

  /**
   * Sets the number of records to skip before returning.
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new skip set.*
   *
   * @param skip - The skip for the cursor query.
   *
   * @returns A new cursor with the new skip set.
   */
  public skip(skip: number): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new skip on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, skip }, this._mapping);
  }

  /**
   * Sets whether the sort vector should be fetched on the very first API call. Note that this is a requirement
   * to use {@link FindCursor.getSortVector}—it'll unconditionally return `null` if this is not set to `true`.
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new setting.*
   *
   * @param includeSortVector - Whether the sort vector should be fetched on the first API call
   *
   * @returns A new cursor with the new sort vector inclusion setting.
   */
  public includeSortVector(includeSortVector = true): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new sort vector on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, includeSortVector }, this._mapping);
  }

  /**
   * Sets the projection for the cursor, overwriting any previous projection.
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new projection set.*
   *
   * **To properly type this method, you should provide a type argument to specify the shape of the projected
   * records.**
   *
   * **Note that you may NOT provide a projection after a mapping is already provided, to prevent potential
   * de-sync errors.** If you really want to do so, you may use {@link FindCursor.clone} to create a new cursor
   * with the same configuration, but without the mapping, and then set the projection.
   *
   * @example
   * ```typescript
   * const cursor = table.find({ name: 'John' });
   *
   * // T is `any` because the type is not specified
   * const rawProjected = cursor.project({ id: 0, name: 1 });
   *
   * // T is { name: string }
   * const projected = cursor.project<{ name: string }>({ id: 0, name: 1 });
   *
   * // You can also chain instead of using intermediate variables
   * const fluentlyProjected = table
   *   .find({ name: 'John' })
   *   .project<{ name: string }>({ id: 0, name: 1 });
   *
   * // It's important to keep mapping in mind
   * const mapProjected = table
   *   .find({ name: 'John' })
   *   .map(doc => doc.name);
   *   .project<string>({ id: 0, name: 1 });
   * ```
   *
   * @param projection - Specifies which fields should be included/excluded in the returned records.
   *
   * @returns A new cursor with the new projection set.
   */
  public project<RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection): FindCursor<RRaw, RRaw> {
    if (this._mapping) {
      throw new CursorError('Cannot set a projection after already using cursor.map(...)', this);
    }
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new projection on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, projection: structuredClone(projection) }, this._mapping);
  }

  /**
   * Sets whether similarity scores should be included in the cursor's results.
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new similarity setting.*
   *
   * @param includeSimilarity - Whether similarity scores should be included.
   *
   * @returns A new cursor with the new similarity setting.
   */
  public includeSimilarity(includeSimilarity = true): FindCursor<WithSim<TRaw>, WithSim<TRaw>> {
    if (this._mapping) {
      throw new CursorError('Cannot set include similarity after already using cursor.map(...)', this);
    }
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new similarity on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, includeSimilarity }, this._mapping);
  }
  
  public map<R>(map: (doc: T) => R): FindCursor<R, TRaw> {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new mapping on a running/closed cursor', this);
    }
    if (this._mapping) {
      return this._clone(this._filter, this._options, (doc: TRaw) => map(this._mapping!(doc)));
    } else {
      return this._clone(this._filter, this._options, map as any);
    }
  }

  /**
   * Retrieves the vector used to perform the vector search, if applicable.
   *
   * - If `includeSortVector` is not `true`, this will unconditionally return `null`. No find request will be made.
   *
   * - If `sort: { $vector }` was used, `getSortVector()` will simply regurgitate that same `$vector`.
   *
   * - If `sort: { $vectorize }` was used, `getSortVector()` will return the `$vector` that was created from the text.
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
    if (this._sortVector.isUnattempted() && this._options.includeSortVector) {
      const reset2idle = this._state === 'idle';

      await this._next(true, '.getSortVector');

      if (reset2idle) {
        this._state = 'idle';
      }
    }

    return this._sortVector.unwrap;
  }

  public override clone(): this {
    return this._clone(this._filter, this._options, this._mapping);
  }

  /**
   * @internal
   */
  private _clone<R, C = this>(filter: SerializedFilter, options: GenericFindOptions, mapping?: (doc: TRaw) => R): C {
    return new (<any>this.constructor)(this._parent, this._serdes, filter, options, mapping);
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
          pageState: this._nextPageState.unwrap,
        },
      },
    };

    const raw = await this._httpClient.executeCommand(command, {
      timeoutManager: tm ?? this._httpClient.tm.single('generalMethodTimeoutMs', this._options),
      bigNumsPresent: this._filter[1],
      extraLogInfo: extra,
    });

    this._nextPageState.swap(raw.data?.nextPageState);
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
