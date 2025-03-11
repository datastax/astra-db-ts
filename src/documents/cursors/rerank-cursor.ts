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
  Filter,
  GenericFindAndRerankOptions,
  GenericFindOptions,
  HybridProjection,
  HybridSort,
  Projection,
  SomeDoc,
  SomeRow,
  Table,
} from '@/src/documents/index.js';
import { CursorError } from '@/src/documents/index.js';
import { AbstractCursor } from '@/src/documents/cursors/abstract-cursor.js';
import type { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';

type SerializedFilter = [unknown, boolean];

export abstract class FindAndRerankCursor<T, TRaw extends SomeDoc = SomeDoc> extends AbstractCursor<T, TRaw> {
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
  declare protected readonly _options: GenericFindAndRerankOptions;

  /**
   * @internal
   */
  private readonly _filter: SerializedFilter;

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
  public sort(sort: HybridSort): this {
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

  public hybridLimits(hybridLimits: number | Record<string, number>): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new limit on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, hybridLimits }, this._mapping);
  }

  public hybridProjection(hybridProjection: HybridProjection): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new limit on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, hybridProjection }, this._mapping);
  }

  public rerankField(rerankField: string): this {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new limit on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, rerankField }, this._mapping);
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
    if (this._mapping) {
      throw new CursorError('Cannot set a projection after already using cursor.map(...)', this);
    }
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new projection on a running/closed cursor', this);
    }
    return this._clone(this._filter, { ...this._options, projection: structuredClone(projection) }, this._mapping);
  }

  public map<R>(map: (doc: T) => R): FindAndRerankCursor<R, TRaw> {
    if (this._state !== 'idle') {
      throw new CursorError('Cannot set a new mapping on a running/closed cursor', this);
    }
    if (this._mapping) {
      return this._clone(this._filter, this._options, (doc: TRaw) => map(this._mapping!(doc)));
    } else {
      return this._clone(this._filter, this._options, map as any);
    }
  }

  public override clone(): this {
    return this._clone(this._filter, this._options, this._mapping);
  }

  /**
   * @internal
   */
  private _clone<R, C = this>(filter: SerializedFilter, options: GenericFindAndRerankOptions, mapping?: (doc: TRaw) => R): C {
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
          limit: this._options.limit,
          hybridLimits: this._options.hybridLimits,
          hybridProjection: this._options.hybridProjection,
          rerankField: this._options.rerankField,
        },
      },
    };

    const raw = await this._httpClient.executeCommand(command, {
      timeoutManager: tm ?? this._httpClient.tm.single('generalMethodTimeoutMs', this._options),
      bigNumsPresent: this._filter[1],
      extraLogInfo: extra,
    });
    const buffer = raw.data?.documents ?? [];

    for (let i = 0, n = buffer.length; i < n; i++) {
      buffer[i] = this._serdes.deserialize(buffer[i], raw, SerDesTarget.Record);
    }

    return buffer;
  }

  /**
   * @internal
   */
  protected _tm(): Timeouts {
    return this._httpClient.tm;
  }
}
