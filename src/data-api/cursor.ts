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

import {
  Filter,
  FindOptions,
  InternalFindOptions,
  InternalGetMoreCommand,
  Projection,
  Sort,
} from '@/src/data-api/types';
import { CursorAlreadyInitializedError, SomeDoc } from '@/src/data-api';
import { DataApiHttpClient } from '@/src/api';

/** @internal */
const enum CursorStatus {
  Uninitialized,
  Initialized,
  Closed,
}

/**
 * Lazily iterates over the document results of a query.
 *
 * **Shouldn't be directly instantiated, but rather created via {@link Collection.find}**.
 *
 * Typed as `FindCursor<T, TRaw>` where `T` is the type of the mapped documents and `TRaw` is the type of the raw
 * documents before any mapping. If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping
 * is done using the {@link map} method.
 *
 * @example
 * ```typescript
 * interface Person {
 *   firstName: string;
 *   lastName: string;
 *   age: number;
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
 */
export class FindCursor<T, TRaw extends SomeDoc = SomeDoc> {
  private readonly _namespace: string;
  private readonly _httpClient: DataApiHttpClient;
  private readonly _options: FindOptions<boolean>;
  private _filter: Filter<SomeDoc>;
  private _mapping?: (doc: unknown) => T;

  private _buffer: TRaw[] = [];
  private _nextPageState?: string | null;
  private _state = CursorStatus.Uninitialized;

  constructor(namespace: string, httpClient: DataApiHttpClient, filter: Filter<SomeDoc>, options?: FindOptions<boolean>) {
    this._namespace = namespace;
    this._httpClient = httpClient;
    this._filter = filter;
    this._options = { ...options };
  }

  /**
   * @return The namespace (aka keyspace) of the parent database.
   */
  get namespace(): string {
    return this._namespace;
  }

  /**
   * @return Whether or not the cursor is closed.
   */
  get closed(): boolean {
    return this._state === CursorStatus.Closed;
  }

  /**
   * @return The number of documents in the buffer.
   */
  bufferedCount(): number {
    return this._buffer.length;
  }

  /**
   * Sets the filter for the cursor, overwriting any previous filter. Note that this filter is weakly typed. Prefer
   * to pass in a filter through the constructor instead, if strongly typed filters are desired.
   *
   * **NB. This method acts on the original documents, before any mapping.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param filter - A filter to select which documents to return.
   *
   * @return The cursor.
   */
  filter(filter: Filter<TRaw>): FindCursor<T, TRaw> {
    this._assertUninitialized();
    this._filter = filter as any;
    return this;
  }

  /**
   * Sets the sort criteria for prioritizing documents. Note that this sort is weakly typed. Prefer to pass in a sort
   * through the constructor instead, if strongly typed sorts are desired.
   *
   * **NB. This method acts on the original documents, before any mapping.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param sort - The sort order to prioritize which documents are returned.
   *
   * @return The cursor.
   */
  sort(sort: Sort): FindCursor<T, TRaw> {
    this._assertUninitialized();
    this._options.sort = sort;
    return this;
  }

  /**
   * Sets the maximum number of documents to return.
   *
   * If `limit == 0`, there will be no limit on the number of documents returned.
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param limit - The limit for this cursor.
   *
   * @return The cursor.
   */
  limit(limit: number): FindCursor<T, TRaw> {
    this._assertUninitialized();
    this._options.limit = limit || Infinity;
    return this;
  }

  /**
   * Sets the number of documents to skip before returning.
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param skip - The skip for the cursor query.
   *
   * @return The cursor.
   */
  skip(skip: number): FindCursor<T, TRaw> {
    this._assertUninitialized();
    this._options.skip = skip;
    return this;
  }

  /**
   * Sets the projection for the cursor, overwriting any previous projection.
   *
   * **NB. This method acts on the original documents, before any mapping.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * **To properly type this method, you should provide a type argument for `T` to specify the shape of the projected
   * documents, *with mapping applied*.**
   *
   * @example
   * ```typescript
   * const cursor = collection.find({ name: 'John' });
   *
   * // T is `any` because the type is not specified
   * const rawProjected = cursor.project({ _id: 0, name: 1 });
   *
   * // T is { name: string }
   * const projected = cursor.project<{ name: string }>({ _id: 0, name: 1 });
   *
   * // You can also chain instead of using intermediate variables
   * const fluentlyProjected = collection
   *   .find({ name: 'John' })
   *   .project<{ name: string }>({ _id: 0, name: 1 });
   *
   * // It's important to keep mapping in mind
   * const mapProjected = collection
   *   .find({ name: 'John' })
   *   .map(doc => doc.name);
   *   .project<string>({ _id: 0, name: 1 });
   * ```
   *
   * @param projection - Specifies which fields should be included/excluded in the returned documents.
   *
   * @return The cursor.
   */
  project<R = any, RRaw extends SomeDoc = SomeDoc>(projection: Projection): FindCursor<R, RRaw> {
    this._assertUninitialized();
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
   * @return The cursor.
   */
  includeSimilarity(includeSimilarity: boolean = true): FindCursor<T, TRaw> {
    this._assertUninitialized();
    this._options.includeSimilarity = includeSimilarity;
    return this;
  }

  /**
   * Map all documents using the provided mapping function. Previous mapping functions will be composed with the new
   * mapping function (new ∘ old).
   *
   * **NB. Unlike Mongo, it is okay to map a cursor to `null`.**
   *
   * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
   *
   * @param mapping - The mapping function to apply to all documents.
   *
   * @return The cursor.
   */
  map<R>(mapping: (doc: T) => R): FindCursor<R, TRaw> {
    this._assertUninitialized();

    if (this._mapping) {
      const oldMapping = this._mapping;
      this._mapping = (doc: unknown) => mapping(oldMapping(doc)) as any;
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
   * @example
   * ```typescript
   * const cursor = collection.find({ name: 'John' });
   * ```
   *
   * @return A behavioral clone of this cursor.
   */
  clone(): FindCursor<TRaw, TRaw> {
    return new FindCursor<TRaw, TRaw>(this._namespace, this._httpClient, this._filter, this._options);
  }

  /**
   * Pulls up to `max` documents from the buffer, or all documents if `max` is not provided.
   *
   * **Note that this actually consumes the buffer; it doesn't just peek at it.**
   *
   * @param max - The maximum number of documents to read from the buffer. If not provided, all documents will be read.
   *
   * @return The documents read from the buffer.
   */
  readBufferedDocuments(max?: number): TRaw[] {
    const toRead = Math.min(max ?? this._buffer.length, this._buffer.length);
    return this._buffer.splice(0, toRead);
  }

  /**
   * Rewinds the cursor to its uninitialized state, clearing the buffer and any state. Any configuration set on the
   * cursor will remain, but iteration will start from the beginning, sending new queries to the server, even if the
   * resultant data was already fetched by this cursor.
   */
  rewind(): void {
    // if (this._state === CursorStatus.Uninitialized) {
    //   return;
    // }

    this._buffer.length = 0;
    this._nextPageState = undefined;
    this._state = CursorStatus.Uninitialized;
  }

  /**
   * Fetches the next document from the cursor. Returns `null` if there are no more documents to fetch.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `null`.
   *
   * @return The next document, or `null` if there are no more documents.
   */
  async next(): Promise<T | null> {
    return this._next(false);
  }

  /**
   * Tests if there is a next document in the cursor.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `false`.
   *
   * @return Whether or not there is a next document.
   */
  async hasNext(): Promise<boolean> {
    if (this._buffer.length > 0) {
      return true;
    }

    const doc = await this._next(true);

    if (doc !== null) {
      this._buffer.push(doc);
      return true;
    }

    return false;
  }

  /**
   * An async iterator that lazily iterates over all documents in the cursor.
   *
   * **Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link rewind}
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
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, void> {
    try {
      while (true) {
        const doc = await this.next();

        if (doc === null) {
          break;
        }

        yield doc;
      }
    } finally {
      await this.close();
    }
  }

  /**
   * Iterates over all documents in the cursor, calling the provided consumer for each document.
   *
   * If the consumer returns `false`, iteration will stop.
   *
   * Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link rewind}
   * to reset the cursor.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return immediately.
   *
   * It will close the cursor when iteration is complete, even if it was stopped early.
   *
   * @param consumer - The consumer to call for each document.
   *
   * @return A promise that resolves when iteration is complete.
   *
   * @deprecated - Prefer the `for await (const doc of cursor) { ... }` syntax instead.
   */
  async forEach(consumer: (doc: T) => boolean | void): Promise<void> {
    for await (const doc of this) {
      if (consumer(doc) === false) {
        break;
      }
    }
  }

  /**
   * Returns an array of all matching documents in the cursor. The user should ensure that there is enough memory to
   * store all documents in the cursor.
   *
   * Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link rewind}
   * to reset the cursor.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return an empty array.
   *
   * @return An array of all documents in the cursor.
   */
  async toArray(): Promise<T[]> {
    const docs: T[] = [];
    for await (const doc of this) {
      docs.push(doc);
    }
    return docs;
  }

  /**
   * Closes the cursor. The cursor will be unusable after this method is called, or until {@link rewind} is called.
   */
  async close(): Promise<void> {
    this._state = CursorStatus.Closed;
  }

  private _assertUninitialized(): void {
    if (this._state !== CursorStatus.Uninitialized) {
      throw new CursorAlreadyInitializedError('Cursor is already initialized/in use; cannot perform options modification. Rewind or clone the cursor.');
    }
  }

  private async _next(raw: true): Promise<TRaw | null>
  private async _next(raw: false): Promise<T | null>
  private async _next(raw: boolean): Promise<T | TRaw | null> {
    if (this._state === CursorStatus.Closed) {
      return null;
    }

    do {
      if (this._buffer.length > 0) {
        const doc = this._buffer.shift()!;

        try {
          return (!raw && this._mapping)
            ? this._mapping(doc)
            : doc;
        } catch (err) {
          await this.close();
          throw err;
        }
      }

      if (this._nextPageState === null) {
        return null;
      }

      try {
        await this._getMore();
      } catch (err) {
        await this.close();
        throw err;
      }
    } while (this._buffer.length !== 0);

    return null;
  }

  private async _getMore(): Promise<void> {
    this._state = CursorStatus.Initialized;

    const options: InternalFindOptions = {};

    if (this._options.limit !== Infinity) {
      options.limit = this._options.limit;
    }
    if (this._nextPageState) {
      options.pagingState = this._nextPageState;
    }
    if (this._options.skip) {
      options.skip = this._options.skip;
    }
    if (this._options.includeSimilarity) {
      options.includeSimilarity = this._options.includeSimilarity;
    }

    const command: InternalGetMoreCommand = {
      find: { filter: this._filter }
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

    const resp = await this._httpClient.executeCommand(command, {});

    this._nextPageState = resp.data!.nextPageState || null;
    this._buffer = resp.data!.documents as TRaw[];
  }
}
