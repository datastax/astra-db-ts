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

export class RerankResult<TRaw> {
  constructor(
    public readonly document: TRaw,
    public readonly scores: Record<string, number>,
  ) {}
}

export abstract class FindAndRerankCursor<T, TRaw extends SomeDoc = SomeDoc> extends AbstractCursor<T, RerankResult<TRaw>> {
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
    return buildFLCFilter(this, filter);
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
  public sort(sort: HybridSort): this {
    return buildFLCSort(this, sort);
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
    return buildFLCOption(this, 'limit', limit || undefined);
  }

  public hybridLimits(hybridLimits: number | Record<string, number>): this {
    return buildFLCOption(this, 'hybridLimits', hybridLimits);
  }

  public rerankOn(rerankOn: string): this {
    return buildFLCOption(this, 'rerankOn', rerankOn);
  }

  public rerankQuery(rerankQuery: string): this {
    return buildFLCOption(this, 'rerankQuery', rerankQuery);
  }

  public includeScores(includeScores: boolean): this {
    return buildFLCOption(this, 'includeScores', includeScores);
  }

  public includeSortVector(includeSortVector?: boolean): this {
    return buildFLCOption(this, 'includeSortVector', includeSortVector ?? true);
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
   * de-sync errors.** If you really want to do so, you may use {@link FindAndRerankCursor.clone} to create a new cursor
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
  public project<RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection): FindAndRerankCursor<RRaw, RRaw> {
    return buildFLCPreMapOption(this, 'projection', projection);
  }

  public map<R>(map: (doc: T) => R): FindAndRerankCursor<R, TRaw> {
    return buildFLCMap(this, map);
  }

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

  public override clone(): this {
    return cloneFLC(this, this._filter, this._options, this._mapping);
  }

  /**
   * @internal
   */
  protected async _nextPage(extra: Record<string, unknown>, tm: TimeoutManager | undefined): Promise<RerankResult<TRaw>[]> {
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
      buffer[i] = new RerankResult(deserialized, raw.data?.documentResponses?.[i] ?? {});
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
