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
  FindAndRerankCursor,
  FindAndRerankPage,
  FindCursor,
  FindPage,
  GenericFindAndRerankOptions,
  GenericFindOptions,
  HybridSort,
  SomeDoc,
  SomeRow,
  Sort,
  Table,
} from '@/src/documents/index.js';
import { vector } from '@/src/documents/datatypes/vector.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import type { RawDataAPIResponse } from '@/src/lib/index.js';
import { CursorError } from '@/src/documents/cursors/cursor-error.js';

/**
 * @internal
 */
export type SerializedFilter = [filter: unknown, bigNumsPresent: boolean];

/**
 * @internal
 */
type FindLikeCursor = FindCursor<any> | FindAndRerankCursor<any>;

/**
 * @internal
 */
type FLCConstructor<C extends FindLikeCursor> = new (...args: ConstructorParameters<typeof FindCursor | typeof FindAndRerankCursor>) => C

/**
 * @internal
 */
type FLCOptions = GenericFindOptions | GenericFindAndRerankOptions;

/**
 * @internal
 */
type FLCPage<T> = FindPage<T> | FindAndRerankPage<T>;

/**
 * @internal
 */
interface CloneFLCOptions<Opts extends FLCOptions> {
  filter?: SerializedFilter,
  options?: Opts,
  mapping?: (doc: SomeDoc) => unknown,
}

/**
 * @internal
 */
export interface FLCNextPageOptions<Opts extends FLCOptions> {
  commandName: 'find' | 'findAndRerank',
  commandOptions: readonly (keyof Opts)[],
  mapPage<TRaw extends SomeDoc>(page: FLCPage<SomeDoc>, raw: RawDataAPIResponse): FLCPage<TRaw>,
}

/**
 * @internal
 */
export class FLCInternal<TRaw extends SomeDoc, Page extends FLCPage<TRaw>, Opts extends FLCOptions> {
  readonly _httpClient: DataAPIHttpClient;
  readonly _serdes: SerDes;
  readonly _parent: Table<SomeRow> | Collection;
  readonly _options: Opts;
  readonly _filter: SerializedFilter;
  readonly _instance: FindLikeCursor;

  constructor(instance: FindLikeCursor, parent: Table<SomeRow> | Collection, serdes: SerDes, filter: SerializedFilter, options?: Opts) {
    this._httpClient = parent._httpClient;
    this._serdes = serdes;
    this._parent = parent;
    this._options = options ?? ({} as Opts);
    this._filter = filter;
    this._instance = instance;
  }

  public withFilter<RC extends FindLikeCursor>(filter?: Filter): RC {
    if (this._instance.state !== 'idle') {
      throw new CursorError(`Cannot set a new filter on a running/closed cursor`, this._instance);
    }
    return this.cloneFLC({ filter: filter && this._serdes.serialize(filter, SerDesTarget.Filter) });
  }

  public withSort<RC extends FindLikeCursor>(sort?: Sort | HybridSort): RC {
    if (this._instance.state !== 'idle') {
      throw new CursorError(`Cannot set a new sort on a running/closed cursor`, this._instance);
    }
    return this.cloneFLC({ options: { ...this._options, sort: sort && this._serdes.serialize(sort, SerDesTarget.Sort)[0] } });
  }

  public withMap<RC extends FindLikeCursor>(map: (doc: any) => unknown): RC {
    if (this._instance.state !== 'idle') {
      throw new CursorError('Cannot set a new mapping on a running/closed cursor', this._instance);
    }

    const mapping = this._instance._mapping
      ? (doc: SomeDoc) => map(this._instance._mapping!(doc))
      : map;

    return this.cloneFLC({ mapping });
  }

  public withInitialPageState<RC extends FindLikeCursor>(pageState?: string): RC {
    if (this._instance.state !== 'idle') {
      throw new CursorError('Cannot set an initial page state on a running/closed cursor', this._instance);
    }

    if (pageState === null) {
      throw new CursorError('Cannot set an initial page state to `null`. If you want an unset page state, set it to `undefined` instead.', this._instance);
    }

    const clone = this.cloneFLC<RC>();

    clone._currentPage = (pageState)
      ? { nextPageState: pageState, result: [] }
      : undefined;

    return clone;
  }

  public withOption<RC extends FindLikeCursor, K extends keyof Opts & string>(key: K, value: Opts[K]): RC {
    if (this._instance.state !== 'idle') {
      throw new CursorError(`Cannot set a new ${key} on a running/closed cursor`, this._instance);
    }
    return this.cloneFLC({ options: { ...this._options, [key]: value } });
  }

  public withPreMapOption<RC extends FindLikeCursor, K extends keyof Opts & string>(key: K, value: Opts[K]): RC {
    if (this._instance._mapping) {
      throw new CursorError(`Cannot set a new ${key} after already using cursor.map(...)`, this._instance);
    }
    return this.withOption(key, value);
  }

  public cloneFLC<RC extends FindLikeCursor>(update?: CloneFLCOptions<Opts>): RC {
    return new (<FLCConstructor<RC>>this._instance.constructor)(this._parent, this._serdes, update?.filter ?? this._filter, update?.options ?? this._options as any, update?.mapping ?? this._instance._mapping);
  }

  public async getSortVector(): Promise<DataAPIVector | null> {
    if (!this._instance._currentPage && this._options.includeSortVector) {
      await this._instance._next(true, '.getSortVector');
    }
    return this._instance._currentPage?.sortVector ?? null;
  }

  public async fetchNextPageMapped<T, TPage extends FLCPage<T>>(opts: FLCNextPageOptions<Opts>): Promise<TPage> {
    if (this._instance._currentPage && this._instance._currentPage.result.length !== 0) {
      throw new CursorError('Cannot fetch next page when the current page is not empty', this._instance);
    }

    const nextPage = (await this.fetchNextPageRaw({ method: '.fetchNextPage' }, undefined, opts))[0];

    const result = this._instance._mapping
      ? nextPage.result.map(r => this._instance._mapping!(r))
      : nextPage.result;

    return { ...nextPage, result } as unknown as TPage;
  }

  public async fetchNextPageRaw(extra: Record<string, unknown>, tm: TimeoutManager | undefined, opts: FLCNextPageOptions<Opts>): Promise<[Page, boolean]> {
    const command = {
      [opts.commandName]: {
        filter: this._filter[0],
        projection: this._options.projection,
        sort: this._options.sort,
        options: {
          ...Object.fromEntries(Object.entries(this._options).filter(([key]) => opts.commandOptions.includes(key as any))),
          pageState: this._instance._currentPage?.nextPageState,
        },
      },
    };

    const raw = await this._httpClient.executeCommand(command, {
      timeoutManager: tm ?? this._httpClient.tm.single('generalMethodTimeoutMs', this._options),
      bigNumsPresent: this._filter[1],
      extraLogInfo: extra,
    });
    this._options.includeSortVector = false;

    const page: FLCPage<SomeDoc> = {
      nextPageState: raw.data?.nextPageState,
      result: raw.data?.documents ?? [],
    };

    if (raw.status?.sortVector) {
      page.sortVector = vector(raw.status.sortVector);
    } else if (this._instance._currentPage?.sortVector) {
      page.sortVector = this._instance._currentPage.sortVector;
    }

    for (let i = 0, n = page.result.length; i < n; i++) {
      page.result[i] = this._serdes.deserialize(page.result[i], raw, SerDesTarget.Record);
    }

    return [opts.mapPage(page, raw) as Page, !!raw.data?.nextPageState];
  }
}
