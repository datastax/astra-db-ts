import { HTTPClient } from '@/src/api';
import {
  FindOptions,
  InternalFindOptions,
  internalFindOptionsKeys,
  InternalGetMoreCommand
} from '@/src/client/types/find/find';
import { SomeDoc } from '@/src/client/document';
import { Filter } from '@/src/client/types/filter';
import { ProjectionOption, SortOption } from '@/src/client/types/common';

/** @internal */
const enum CursorStatus {
  Uninitialized,
  Initialized,
  Closed,
}

/**
 * Worth adding a second data type parameter to this class, so that we can type mapped cursors properly, or no??
 */
export class FindCursorV2<T> {
  private readonly _namespace: string;
  private readonly _httpClient: HTTPClient;
  private readonly _options: FindOptions<SomeDoc, boolean>;
  private _filter: Filter<SomeDoc>;
  private _mapping?: (doc: unknown) => T;

  private _buffer: T[] = [];
  private _nextPageState?: string | null;
  private _state = CursorStatus.Uninitialized;
  private _numReturned = 0;

  constructor(namespace: string, httpClient: HTTPClient, filter: Filter<SomeDoc>, options?: FindOptions<SomeDoc, boolean>) {
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
   * The cursor MUST be uninitialized when calling this method.
   *
   * **NB. This method mutates the cursor.**
   *
   * **NB. This method acts on the original documents, before any mapping**
   *
   * @param filter - A filter to select which documents to return.
   *
   * @return The cursor.
   */
  filter(filter: Filter<SomeDoc>): FindCursorV2<T> {
    this._assertUninitialized();
    this._filter = filter;
    return this;
  }

  /**
   * Sets the sort criteria for prioritizing documents. Note that this sort is weakly typed. Prefer to pass in a sort
   * through the constructor instead, if strongly typed sorts are desired.
   *
   * The cursor MUST be uninitialized when calling this method.
   *
   * **NB. This method mutates the cursor.**
   *
   * **NB. This method acts on the original documents, before any mapping**
   *
   * @param sort - The sort order to prioritize which documents are returned.
   *
   * @return The cursor.
   */
  sort(sort: SortOption<SomeDoc>): FindCursorV2<T> {
    this._assertUninitialized();
    this._options.sort = sort;
    return this;
  }

  /**
   * Sets the maximum number of documents to return.
   *
   * The cursor MUST be uninitialized when calling this method.
   *
   * **NB. This method mutates the cursor.**
   *
   * @param limit - The limit for this cursor.
   *
   * @return The cursor.
   */
  limit(limit: number): FindCursorV2<T> {
    this._assertUninitialized();
    this._options.limit = limit;
    return this;
  }

  /**
   * Sets the number of documents to skip before returning.
   *
   * The cursor MUST be uninitialized when calling this method.
   *
   * **NB. This method mutates the cursor.**
   *
   * @param skip - The skip for the cursor query.
   *
   * @return The cursor.
   */
  skip(skip: number): FindCursorV2<T> {
    this._assertUninitialized();
    this._options.skip = skip;
    return this;
  }

  /**
   * Sets the projection for the cursor, overwriting any previous projection. Note that this projection is weakly typed.
   * Prefer to pass in a projection through the constructor instead, if strongly typed projections are desired.
   *
   * The cursor MUST be uninitialized when calling this method.
   *
   * **NB. This method mutates the cursor.**
   *
   * **NB. This method acts on the original documents, before any mapping**
   *
   * @param projection - Specifies which fields should be included/excluded in the returned documents.
   *
   * @return The cursor.
   */
  project<R>(projection: ProjectionOption<SomeDoc>): FindCursorV2<R> {
    this._assertUninitialized();
    this._options.projection = projection;
    return this as any;
  }

  /**
   * Map all documents using the provided mapping function. Previous mapping functions will be composed with the new
   * mapping function (new ∘ old).
   *
   * The cursor MUST be uninitialized when calling this method.
   *
   * **NB. This method mutates the cursor.**
   *
   * **NB. Unlike Mongo, it is okay to map a cursor to `null`.**
   *
   * @param mapping - The mapping function to apply to all documents.
   *
   * @return The cursor.
   */
  map<R>(mapping: (doc: T) => R): FindCursorV2<R> {
    this._assertUninitialized();

    if (this._mapping) {
      this._mapping = (doc: unknown) => mapping(this._mapping!(doc)) as any;
    } else {
      this._mapping = mapping as any;
    }

    return this as any;
  }

  /**
   * Sets the batch size for the cursor's buffer.
   *
   * The cursor MUST be uninitialized when calling this method.
   *
   * **NB. This method mutates the cursor.**
   *
   * @param batchSize - The batch size for this cursor.
   *
   * @return The cursor.
   */
  batchSize(batchSize: number): FindCursorV2<T> {
    this._assertUninitialized();
    this._options.batchSize = batchSize;
    return this;
  }

  /**
   * Returns a new, uninitialized cursor with the same filter and options set on this cursor. No state is shared between
   * the two cursors; only the configuration. Mapping functions are not cloned.
   *
   * @return A behavioral clone of this cursor.
   */
  clone(): FindCursorV2<T> {
    return new FindCursorV2(this._namespace, this._httpClient, this._filter, this._options);
  }

  /**
   * I'm so blimming confused. I've been looking at MongoDB's code for this method and for some reason it's typed
   * as returning a `T[]` while in reality it appears to return an array of the original documents, not the mapped
   * documents??? No clue if it's a bug or if I'm just misunderstanding something, but I can't find anything
   * about this method online beyond basic documentation.
   */
  readBufferedDocuments(max?: number): T[] {
    const toRead = Math.min(max ?? this._buffer.length, this._buffer.length);
    return this._buffer.splice(0, toRead);
  }

  /**
   * Rewinds the cursor to its uninitialized state, clearing the buffer and any state. Any configuration set on the
   * cursor will remain, but iteration will start from the beginning, sending new queries to the server, even if the
   * resultant data was already fetched by this cursor.
   */
  rewind(): void {
    if (this._state === CursorStatus.Uninitialized) {
      return;
    }

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
    return this._next(false, true);
  }

  /**
   * Attempts to fetch the next document from the cursor. Returns `null` if there are no more documents to fetch.
   *
   * Will also return `null` if the buffer is exhausted.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `null`.
   *
   * @return The next document, or `null` if there are no more documents.
   */
  async tryNext(): Promise<T | null> {
    return this._next(false, false);
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

    const doc = await this._next(true, true);

    if (doc !== null) {
      this._buffer.push(doc);
      return true;
    }

    return false;
  }

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
   * Returns the number of documents matching the cursor. This method will iterate over the entire cursor to count the
   * documents.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return 0.
   *
   * @return The number of documents matching the cursor.
   *
   * @deprecated - Use {@link Collection.countDocuments} instead.
   */
  async count(): Promise<number> {
    let count = 0;
    for await (const _ of this) {
      count++;
    }
    return count;
  }

  /**
   * Closes the cursor. The cursor will be unusable after this method is called, or until {@link rewind} is called.
   */
  async close(): Promise<void> {
    this._state = CursorStatus.Closed;
  }

  private _assertUninitialized(): void {
    if (this._state !== CursorStatus.Uninitialized) {
      throw new Error('Cursor has already been initialized');
    }
  }

  private async _next(raw: boolean, block: boolean): Promise<T | null> {
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

      if (this._buffer.length === 0 && !block) {
        return null;
      }
    } while (this._buffer.length !== 0);

    return null;
  }

  private async _getMore(): Promise<void> {
    this._state = CursorStatus.Initialized;

    const options: InternalFindOptions = {};

    const limit = this._options.limit ?? Infinity;
    const batchSize = this._options.batchSize ?? 1000;

    const queryLimit = (limit && limit > 0 && this._numReturned + batchSize > limit)
      ? limit - this._numReturned
      : batchSize;

    if (queryLimit <= 0) {
      this._nextPageState = null;
      return;
    }

    if (queryLimit !== Infinity) {
      options.limit = queryLimit;
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

    const resp = await this._httpClient.executeCommand(command, internalFindOptionsKeys);

    this._nextPageState = resp.data!.nextPageState || null;
    this._buffer = resp.data!.documents as T[];
    this._numReturned += this._buffer.length;
  }
}
