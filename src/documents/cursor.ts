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

import { Filter, SomeDoc } from '@/src/documents/collections';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { normalizedSort } from '@/src/documents/utils';
import { CursorIsStartedError } from '@/src/documents/errors';
import { Projection, Sort } from '@/src/documents/types';
import { GenericFindOptions } from '@/src/documents/commands';
import { nullish } from '@/src/lib';

const enum CursorStatus {
  Idle = "idle",
  Started = "started",
  Closed = "closed",
}

interface InternalFindOptions {
  pageState?: string,
  limit?: number,
  skip?: number,
  includeSimilarity?: boolean,
  includeSortVector?: boolean,
}

interface InternalGetMoreCommand {
  find: {
    filter?: Record<string, unknown>,
    options?: InternalFindOptions,
    sort?: Record<string, unknown>,
    projection?: Record<string, unknown>,
  },
}

export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Lazily iterates over the results of some generic `find` operation using a Data API.
 *
 * **Shouldn't be directly instantiated, but rather created via {@link Collection.find}**.
 *
 * Typed as `FindCursor<T, TRaw>` where `T` is the type of the mapped records and `TRaw` is the type of the raw
 * records before any mapping. If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping
 * is done using the {@link FindCursor.map} method.
 *
 * @example
 * ```typescript
 * interface Person {
 *   firstName: string,
 *   lastName: string,
 *   age: number,
 * }
 *
 * const collection = db.collection<Person>('people');
 * let cursor = collection.find().filter({ firstName: 'John' });
 *
 * // Lazily iterate all documents matching the filter
 * for await (const doc of cursor) {
 *   console.log(doc);
 * }
 *
 * // Rewind the cursor to be able to iterate again
 * cursor.rewind();
 *
 * // Get all documents matching the filter as an array
 * const docs = await cursor.toArray();
 *
 * cursor.rewind();
 *
 * // Set options & map as needed
 * cursor: Cursor<string> = cursor
 *   .project<Omit<Person, 'age'>>({ firstName: 1, lastName: 1 })
 *   .map(doc => doc.firstName + ' ' + doc.lastName);
 *
 * // Get next document from cursor
 * const doc = await cursor.next();
 * ```
 *
 * @public
 */
export class FindCursor<T, TRaw extends SomeDoc = SomeDoc> {
  readonly #keyspace: string;
  readonly #httpClient: DataAPIHttpClient;

  private readonly _options: GenericFindOptions;
  private _filter: Filter<TRaw>;
  private _mapping?: (doc: TRaw) => T;
  private _buffer: TRaw[] = [];
  private _nextPageState?: string | null;
  private _state = CursorStatus.Idle;
  private _sortVector?: number[] | null;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  constructor(keyspace: string, httpClient: DataAPIHttpClient, filter: Filter<TRaw>, options?: GenericFindOptions) {
    this.#keyspace = keyspace;
    this.#httpClient = httpClient;
    this._filter = structuredClone(filter);
    this._options = structuredClone(options ?? {});

    if (options?.sort) {
      this._options.sort = normalizedSort(options.sort);
    }
  }

  /**
   * The keyspace of the collection that's being iterated over.
   *
   * @returns The keyspace of the collection that's being iterated over.
   */
  public get keyspace(): string {
    return this.#keyspace;
  }

  /**
   * Whether the cursor is closed, whether it be manually, or because the cursor is exhausted.
   *
   * @returns Whether or not the cursor is closed.
   */
  public get closed(): boolean {
    return this._state === CursorStatus.Closed;
  }

  /**
   * Returns the number of raw records in the buffer. If the cursor is unused, it'll return 0.
   *
   * @returns The number of raw records in the buffer.
   */
  public bufferedCount(): number {
    return this._buffer.length;
  }

  /**
   * Pulls up to `max` records from the buffer, or all records if `max` is not provided.
   *
   * **Note that this actually consumes the buffer; it doesn't just peek at it.**
   *
   * @param max - The maximum number of records to read from the buffer. If not provided, all records will be read.
   *
   * @returns The records read from the buffer.
   */
  public consumeBuffer(max?: number): TRaw[] {
    return this._buffer.splice(0, max ?? this._buffer.length);
  }

  /**
   * Sets the filter for the cursor, overwriting any previous filter. Note that this filter is weakly typed. Prefer
   * to pass in a filter through the constructor instead, if strongly typed filters are desired.
   *
   * **NB. This method acts on the original raw records, before any mapping.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param filter - A filter to select which records to return.
   *
   * @returns The cursor.
   *
   * @see StrictFilter
   */
  public filter(filter: Filter<TRaw>): this {
    this.#assertUninitialized();
    this._filter = filter;
    return this;
  }

  /**
   * Sets the sort criteria for prioritizing records. Note that this sort is weakly typed. Prefer to pass in a sort
   * through the constructor instead, if strongly typed sorts are desired.
   *
   * **NB. This method acts on the original records, before any mapping.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param sort - The sort order to prioritize which records are returned.
   *
   * @returns The cursor.
   *
   * @see StrictSort
   */
  public sort(sort: Sort): this {
    this.#assertUninitialized();
    this._options.sort = normalizedSort(sort);
    return this;
  }

  /**
   * Sets the maximum number of records to return.
   *
   * If `limit == 0`, there will be no limit on the number of records returned.
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param limit - The limit for this cursor.
   *
   * @returns The cursor.
   */
  public limit(limit: number): this {
    this.#assertUninitialized();
    this._options.limit = limit || Infinity;
    return this;
  }

  /**
   * Sets the number of records to skip before returning.
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param skip - The skip for the cursor query.
   *
   * @returns The cursor.
   */
  public skip(skip: number): this {
    this.#assertUninitialized();
    this._options.skip = skip;
    return this;
  }

  /**
   * Sets the projection for the cursor, overwriting any previous projection.
   *
   * **NB. This method acts on the original records, before any mapping.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * **To properly type this method, you should provide a type argument for `T` to specify the shape of the projected
   * records, *with mapping applied*.**
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
   * @returns The cursor.
   *
   * @see StrictProjection
   */
  public project<RRaw extends SomeDoc = DeepPartial<TRaw>>(projection: Projection): FindCursor<RRaw, RRaw> {
    this.#assertUninitialized();

    if (this._mapping) {
      throw new Error('Cannot set a projection after already using cursor.map(...)');
    }

    this._options.projection = projection;
    return this as any;
  }

  /**
   * Sets whether similarity scores should be included in the cursor's results.
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param includeSimilarity - Whether similarity scores should be included.
   *
   * @returns The cursor.
   */
  public includeSimilarity(includeSimilarity: boolean = true): this {
    this.#assertUninitialized();
    this._options.includeSimilarity = includeSimilarity;
    return this;
  }

  /**
   * Sets whether the sort vector should be fetched on the very first API call. Note that this is a requirement
   * to use {@link FindCursor.getSortVector}—it'll unconditionally return `null` if this is not set to `true`.
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param includeSortVector - Whether the sort vector should be fetched on the first API call
   *
   * @returns The cursor.
   */
  public includeSortVector(includeSortVector: boolean = true): this {
    this.#assertUninitialized();
    this._options.includeSortVector = includeSortVector;
    return this;
  }

  /**
   * Map all records using the provided mapping function. Previous mapping functions will be composed with the new
   * mapping function (new ∘ old).
   *
   * **NB. Unlike Mongo, it is okay to map a cursor to `null`.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param mapping - The mapping function to apply to all records.
   *
   * @returns The cursor.
   */
  public map<R>(mapping: (doc: T) => R): FindCursor<R, TRaw> {
    this.#assertUninitialized();

    if (this._mapping) {
      const oldMapping = this._mapping;
      this._mapping = (doc: TRaw) => mapping(oldMapping(doc)) as any;
    } else {
      this._mapping = mapping as any;
    }

    return this as any;
  }

  /**
   * Returns a new, uninitialized cursor with the same filter and options set on this cursor. No state is shared between
   * the two cursors; only the configuration.
   *
   * Like mongo, mapping functions are *not* cloned.
   *
   * @returns A behavioral clone of this cursor.
   */
  public clone(): FindCursor<TRaw, TRaw> {
    return new FindCursor(this.#keyspace, this.#httpClient, this._filter, this._options);
  }

  /**
   * Rewinds the cursor to its uninitialized state, clearing the buffer and any state. Any configuration set on the
   * cursor will remain, but iteration will start from the beginning, sending new queries to the server, even if the
   * resultant data was already fetched by this cursor.
   */
  public rewind(): void {
    this._buffer.length = 0;
    this._nextPageState = undefined;
    this._state = CursorStatus.Idle;
  }

  /**
   * Fetches the next record from the cursor. Returns `null` if there are no more records to fetch.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `null`.
   *
   * @returns The next record, or `null` if there are no more records.
   */
  public async next(): Promise<T | null> {
    return await this.#next(false) ?? null;
  }

  /**
   * Tests if there is a next record in the cursor.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `false`.
   *
   * @returns Whether or not there is a next record.
   */
  public async hasNext(): Promise<boolean> {
    return await this.#next(true) !== null;
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
  public async getSortVector(): Promise<number[] | null> {
    if (this._sortVector === undefined) {
      if (this._options.includeSortVector) {
        void await this.hasNext();
      } else {
        return null;
      }
    }
    return this._sortVector!;
  }

  /**
   * An async iterator that lazily iterates over all records in the cursor.
   *
   * **Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link FindCursor.rewind}
   * to reset the cursor.**
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return immediately.
   *
   * It will close the cursor when iteration is complete, even if it was broken early.
   *
   * @example
   * ```typescript
   * for await (const doc of cursor) {
   *   console.log(doc);
   * }
   * ```
   */
  public async *[Symbol.asyncIterator](): AsyncGenerator<T, void, void> {
    try {
      while (true) {
        const doc = await this.next();

        if (doc === null) {
          break;
        }

        yield doc;
      }
    } finally {
      this.close();
    }
  }

  /**
   * Iterates over all records in the cursor, calling the provided consumer for each record.
   *
   * If the consumer returns `false`, iteration will stop.
   *
   * Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link FindCursor.rewind}
   * to reset the cursor.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return immediately.
   *
   * It will close the cursor when iteration is complete, even if it was stopped early.
   *
   * @param consumer - The consumer to call for each record.
   *
   * @returns A promise that resolves when iteration is complete.
   */
  public async forEach(consumer: ((doc: T) => boolean) | ((doc: T) => void)): Promise<void> {
    for await (const doc of this) {
      if (consumer(doc) === false) {
        break;
      }
    }
  }

  /**
   * Returns an array of all matching records in the cursor. The user should ensure that there is enough memory to
   * store all records in the cursor.
   *
   * Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link FindCursor.rewind}
   * to reset the cursor.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return an empty array.
   *
   * @returns An array of all records in the cursor.
   */
  public async toArray(): Promise<T[]> {
    const docs: T[] = [];
    for await (const doc of this) {
      docs.push(doc);
    }
    return docs;
  }

  /**
   * Closes the cursor. The cursor will be unusable after this method is called, or until {@link FindCursor.rewind} is called.
   */
  public close(): void {
    this._state = CursorStatus.Closed;
    this._buffer = [];
  }

  #assertUninitialized(): void {
    if (this._state !== CursorStatus.Idle) {
      throw new CursorIsStartedError('Cursor is already initialized/in use; cannot perform options modification. Rewind or clone the cursor to modify its options and rerun it.');
    }
  }

  async #next(peek: true): Promise<TRaw | nullish>
  async #next(peek: false): Promise<T | nullish>
  async #next(peek: boolean): Promise<T | TRaw | nullish> {
    if (this._state === CursorStatus.Closed) {
      return null;
    }
    this._state = CursorStatus.Started;

    try {
      if (this._buffer.length === 0) {
        await this.#getMore();
      }

      if (peek) {
        return this._buffer.at(-1);
      }

      const doc = this._buffer.shift();

      return (doc && this._mapping)
        ? this._mapping(doc)
        : doc;
    } catch (e) {
      this.close();
      throw e;
    }
  }

  async #getMore(): Promise<void> {
    const options: InternalFindOptions = {};

    if (this._options.limit !== Infinity) {
      options.limit = this._options.limit;
    }
    if (this._nextPageState) {
      options.pageState = this._nextPageState;
    }
    if (this._options.skip) {
      options.skip = this._options.skip;
    }
    if (this._options.includeSimilarity) {
      options.includeSimilarity = this._options.includeSimilarity;
    }
    if (this._options.includeSortVector) {
      options.includeSortVector = this._options.includeSortVector;
    }

    const command: InternalGetMoreCommand = {
      find: { filter: this._filter },
    };

    if (this._options.sort) {
      command.find.sort = this._options.sort;
    }
    if (this._options.projection) {
      command.find.projection = this._options.projection;
    }
    if (Object.keys(options).length > 0) {
      command.find.options = options;
    }

    const resp = await this.#httpClient.executeCommand(command, {});

    this._nextPageState = resp.data?.nextPageState || null;
    this._buffer = resp.data?.documents ?? [];

    this._sortVector ??= resp.status?.sortVector;
    this._options.includeSortVector = false;
  }
}
