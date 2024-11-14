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

import type { Collection, Filter, SomeDoc } from '@/src/documents/collections';
import type { GenericFindOptions } from '@/src/documents/commands';
import type { Projection, Sort } from '@/src/documents/types';
import type { DeepPartial, nullish } from '@/src/lib';
import { normalizedSort } from '@/src/documents/utils';
import { $CustomInspect } from '@/src/lib/constants';
import type { DataAPISerDes } from '@/src/lib/api/ser-des';
import { DataAPIError } from '@/src/documents/errors';
import type { Table } from '@/src/documents/tables';

export class CursorError extends DataAPIError {
  public readonly cursor: FindCursor<unknown>;
  public readonly state: CursorStatus;

  constructor(message: string, cursor: FindCursor<unknown>) {
    super(message);
    this.name = 'CursorError';
    this.cursor = cursor;
    this.state = cursor.state;
  }
}

/**
 * Represents the status of a cursor.
 *
 * | Status         | Description                                                                        |
 * |----------------|------------------------------------------------------------------------------------|
 * | `idle`         | The cursor is uninitialized/not in use, and may be modified freely.                |
 * | `started`      | The cursor is currently in use, and cannot be modified w/out rewinding or cloning. |
 * | `closed`       | The cursor is closed, and cannot be used w/out rewinding or cloning.               |
 *
 * @public
 *
 * @see FindCursor.state
 */
export type CursorStatus = 'idle' | 'started' | 'closed';

interface InternalFindOptions {
  limit: number | undefined,
  skip: number | undefined,
  includeSimilarity: boolean | undefined,
  includeSortVector: boolean | undefined,
  pageState: string | undefined,
}

interface InternalGetMoreCommand {
  find: {
    filter: Record<string, unknown> | undefined,
    sort: Record<string, unknown> | undefined,
    projection: Record<string, unknown> | undefined,
    options: InternalFindOptions | undefined,
  },
}

/**
 * Lazily iterates over the results of some generic `find` operation using a Data API.
 *
 * **Shouldn't be directly instantiated, but rather created via {@link Collection.find}**.
 *
 * Typed as `FindCursor<T, TRaw>` where `T` is the type of the mapped records and `TRaw` is the type of the raw
 * records before any mapping. If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping
 * is done using the {@link FindCursor.map} method.
 *
 * Options may be set either through the `find({}, options)` method, or through the various fluent option-setting
 * methods, which, ***unlike Mongo***, do not mutate the existing cursor, but rather return a new, uninitialized cursor
 * with the new option(s) set. This means that option methods may be called even after the cursor is started.
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
 * const cursor1: Cursor<Person> = collection.find().filter({ firstName: 'John' });
 *
 * // Lazily iterate all documents matching the filter
 * for await (const doc of cursor1) {
 *   console.log(doc);
 * }
 *
 * // Rewind the cursor to be able to iterate again
 * cursor1.rewind();
 *
 * // Get all documents matching the filter as an array
 * const docs = await cursor1.toArray();
 *
 * // Immutably set options & map as needed (changing options returns a new, uninitialized cursor)
 * const cursor2: Cursor<string> = cursor
 *   .project<Omit<Person, 'age'>>({ age: 0 })
 *   .map(doc => doc.firstName + ' ' + doc.lastName);
 *
 * // Get next document from cursor
 * const doc = await cursor2.next();
 * ```
 *
 * @public
 */
export abstract class FindCursor<T, TRaw extends SomeDoc = SomeDoc> {
  readonly #parent: Table | Collection;
  readonly #serdes: DataAPISerDes;

  readonly #options: GenericFindOptions;
  readonly #filter: [Filter<TRaw>, boolean];
  readonly #mapping?: (doc: any) => T;

  #buffer: TRaw[] = [];
  #nextPageState?: string | null;
  #state = 'idle' as CursorStatus;
  #sortVector?: number[] | null;
  #consumed: number = 0;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  constructor(parent: Table | Collection, serdes: DataAPISerDes, filter: [Filter<TRaw>, boolean], options?: GenericFindOptions, mapping?: (doc: TRaw) => T) {
    this.#parent = parent;
    this.#serdes = serdes;
    this.#filter = filter;
    this.#options = options ?? {};
    this.#mapping = mapping;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `FindCursor(source="${this.#parent.keyspace}.${this.#parent.name}",state="${this.#state}",consumed=${this.#consumed},buffered=${this.#buffer.length})`,
    });
  }

  /**
   * The table/collection which spawned this cursor.
   *
   * @returns The table/collection which spawned this cursor.
   */
  public get dataSource(): Table | Collection {
    return this.#parent;
  }

  /**
   * Whether the cursor is closed, whether it be manually, or because the cursor is exhausted.
   *
   * @returns Whether or not the cursor is closed.
   */
  public get state(): CursorStatus {
    return this.#state;
  }

  /**
   * Returns the number of raw records in the buffer. If the cursor is unused, it'll return 0.
   *
   * Unless the cursor was closed before the buffer was completely read, the total number of records retrieved from the
   * server is equal to ({@link FindCursor.consumed} + {@link FindCursor.buffered}).
   *
   * @returns The number of raw records in the buffer.
   */
  public buffered(): number {
    return this.#buffer.length;
  }

  /**
   * Returns the number of records that have been read be the user from the cursor.
   *
   * Unless the cursor was closed before the buffer was completely read, the total number of records retrieved from the
   * server is equal to ({@link FindCursor.consumed} + {@link FindCursor.buffered}).
   *
   * @returns The number of records that have been read be the user from the cursor.
   */
  public consumed(): number {
    return this.#consumed;
  }

  /**
   * Consumes up to `max` records from the buffer, or all records if `max` is not provided.
   *
   * **Note that this actually consumes the buffer; it doesn't just peek at it.**
   *
   * @param max - The maximum number of records to read from the buffer. If not provided, all records will be read.
   *
   * @returns The records read from the buffer.
   */
  public consumeBuffer(max?: number): TRaw[] {
    return this.#buffer.splice(0, max ?? this.#buffer.length);
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
   *
   * @see StrictFilter
   */
  public filter(filter: Filter<TRaw>): FindCursor<T,  TRaw> {
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new filter on a running/closed cursor', this);
    }
    return this.#clone(this.#serdes.serializeRecord(structuredClone(filter)), this.#options, this.#mapping);
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
   *
   * @see StrictSort
   */
  public sort(sort: Sort): FindCursor<T,  TRaw> {
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new sort on a running/closed cursor', this);
    }
    const options = { ...this.#options, sort: normalizedSort(sort) };
    return this.#clone(this.#filter, options, this.#mapping);
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
  public limit(limit: number): FindCursor<T,  TRaw> {
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new limit on a running/closed cursor', this);
    }
    const options = { ...this.#options, limit: limit || Infinity };
    return this.#clone(this.#filter, options, this.#mapping);
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
  public skip(skip: number): FindCursor<T,  TRaw> {
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new skip on a running/closed cursor', this);
    }
    const options = { ...this.#options, skip };
    return this.#clone(this.#filter, options, this.#mapping);
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
   *
   * @see StrictProjection
   */
  public project<RRaw extends SomeDoc = DeepPartial<TRaw>>(projection: Projection): FindCursor<RRaw,  RRaw> {
    if (this.#mapping) {
      throw new CursorError('Cannot set a projection after already using cursor.map(...)', this);
    }
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new projection on a running/closed cursor', this);
    }
    const options = { ...this.#options, projection: structuredClone(projection) };
    return this.#clone(this.#filter as any, options, this.#mapping);
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
  public includeSimilarity(includeSimilarity: boolean = true): FindCursor<T,  TRaw> {
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new similarity on a running/closed cursor', this);
    }
    const options = { ...this.#options, includeSimilarity };
    return this.#clone(this.#filter, options, this.#mapping);
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
  public includeSortVector(includeSortVector: boolean = true): FindCursor<T,  TRaw> {
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new sort vector on a running/closed cursor', this);
    }
    const options = { ...this.#options, includeSortVector };
    return this.#clone(this.#filter, options, this.#mapping);
  }

  /**
   * Map all records using the provided mapping function. Previous mapping functions will be composed with the new
   * mapping function (new ∘ old).
   *
   * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
   * returns a new, uninitialized cursor with the given new mapping set.*
   *
   * **You may NOT set a projection after a mapping is already provided, to prevent potential de-sync errors.** If you
   * really want to do so, you may use {@link FindCursor.clone} to create a new cursor with the same configuration, but
   * without the mapping, and then set the projection.
   *
   * @param mapping - The mapping function to apply to all records.
   *
   * @returns A new cursor with the new mapping set.
   */
  public map<R>(mapping: (doc: T) => R): FindCursor<R, TRaw> {
    if (this.#state !== 'idle') {
      throw new CursorError('Cannot set a new mapping on a running/closed cursor', this);
    }
    if (this.#mapping) {
      return this.#clone(this.#filter, this.#options, (doc: TRaw) => mapping(this.#mapping!(doc)));
    } else {
      return this.#clone(this.#filter, this.#options, mapping as any);
    }
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
    return new (<any>this.constructor)(this.#parent, this.#serdes, this.#filter, this.#options);
  }

  /**
   * Rewinds the cursor to its uninitialized state, clearing the buffer and any state. Any configuration set on the
   * cursor will remain, but iteration will start from the beginning, sending new queries to the server, even if the
   * resultant data was already fetched by this cursor.
   */
  public rewind(): void {
    this.#buffer.length = 0;
    this.#nextPageState = undefined;
    this.#state = 'idle';
  }

  /**
   * Fetches the next record from the cursor. Returns `null` if there are no more records to fetch.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `null`.
   *
   * @returns The next record, or `null` if there are no more records.
   */
  public async next(): Promise<T | null> {
    return this.#next(false);
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
    if (this.#sortVector === undefined) {
      if (this.#options.includeSortVector) {
        void await this.hasNext();
      } else {
        return null;
      }
    }
    return this.#sortVector!;
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
    if (this.state === 'closed') {
      throw new CursorError('Cannot iterate over a closed cursor', this);
    }

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
    if (this.state === 'closed') {
      throw new CursorError('Cannot iterate over a closed cursor', this);
    }

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
    if (this.state === 'closed') {
      throw new CursorError('Cannot convert a closed cursor to an array', this);
    }

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
    this.#state = 'closed';
    this.#buffer.length = 0;
  }

  #clone<R, RRaw extends SomeDoc>(filter: [Filter<RRaw>, boolean], options: GenericFindOptions, mapping?: (doc: RRaw) => R): FindCursor<R,  RRaw> {
    return new (<any>this.constructor)(this.#parent, this.#serdes, filter, options, mapping);
  }

  async #next(peek: true): Promise<TRaw | nullish>
  async #next(peek: false): Promise<T>
  async #next(peek: boolean): Promise<T | TRaw | nullish> {
    if (this.#state === 'closed') {
      return null;
    }
    this.#state = 'started';

    try {
      while (this.#buffer.length === 0) {
        if (this.#nextPageState === null) {
          this.close();
          return null;
        }
        await this.#getMore();
      }

      if (peek) {
        return this.#buffer.at(-1);
      }

      const doc = this.#buffer.shift();
      if (doc) this.#consumed++;

      return (doc && this.#mapping)
        ? this.#mapping(doc)
        : doc;
    } catch (e) {
      this.close();
      throw e;
    }
  }

  async #getMore(): Promise<void> {
    const command: InternalGetMoreCommand = {
      find: {
        filter: this.#filter[0],
        projection: this.#options.projection,
        sort: this.#options.sort,
        options: {
          includeSimilarity: this.#options.includeSimilarity,
          includeSortVector: this.#options.includeSortVector,
          limit: this.#options.limit,
          skip: this.#options.skip,
          pageState: this.#nextPageState ?? undefined,
        },
      },
    };

    const raw = await this.#parent._httpClient.executeCommand(command, { bigNumsPresent: this.#filter[1] });

    this.#nextPageState = raw.data?.nextPageState || null;
    this.#buffer = raw.data?.documents ?? [];

    for (let i = 0, n = this.#buffer.length; i < n; i++) {
      this.#buffer[i] = this.#serdes.deserializeRecord(this.#buffer[i], raw) as TRaw;
    }

    this.#sortVector ??= raw.status?.sortVector;
    this.#options.includeSortVector = false;
  }
}
