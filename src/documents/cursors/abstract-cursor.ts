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

import type { SomeDoc } from '@/src/documents/index.js';
import type { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import { CursorError } from '@/src/documents/cursors/cursor-error.js';
import type { CommandOptions } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * Represents the status of some {@link AbstractCursor}.
 *
 * | Status         | Description                                                                        |
 * |----------------|------------------------------------------------------------------------------------|
 * | `idle`         | The cursor is uninitialized/not in use, and may be modified freely.                |
 * | `started`      | The cursor is currently in use, and cannot be modified w/out rewinding or cloning. |
 * | `closed`       | The cursor is closed, and cannot be used w/out rewinding or cloning.               |
 *
 * ---
 *
 * ##### State Transitions
 *
 * - **idle → started:** Occurs when `next()`, `hasNext()`, iteration, or any other method that fetches data is called.
 * - **started → closed:** Occurs when iteration completes, an error is thrown during iteration, or `close()` is explicitly called.
 * - **\* → idle:** Occurs when `rewind()` is called on any cursor.
 *
 * @public
 *
 * @see AbstractCursor.state
 */
export type CursorState = 'idle' | 'started' | 'closed';

/**
 * ##### Overview
 *
 * Represents some lazy, abstract iterable cursor over any arbitrary data, which may or may not be paginated.
 *
 * > **⚠️Warning:** This shouldn't be directly instantiated, but rather spawned via {@link Collection.findAndRerank}/{@link Collection.find}, or their {@link Table} alternatives.
 *
 * ---
 *
 * ##### Typing
 *
 * > **✏️Note:** You may generally treat the cursor as if it were typed simply as `AbstractCursor<T>`.
 * >
 * > If you're using a projection, it is heavily recommended to provide an explicit type representing the type of the document after projection.
 *
 * In full, the cursor is typed as `AbstractCursor<T, TRaw>`, where
 * - `T` is the type of the mapped records, and
 * - `TRaw` is the type of the raw records before any mapping.
 *
 * If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping is done using the {@link AbstractCursor.map} method.
 *
 * `TRaw` is currently only publicly exposed in `consumeBuffer()`.
 *
 * @see CollectionFindCursor
 * @see CollectionFindAndRerankCursor
 * @see TableFindCursor
 *
 * @public
 */
export abstract class AbstractCursor<T, TRaw extends SomeDoc = SomeDoc> {
  /**
   * @internal
   */
  private _consumed = 0;

  /**
   * @internal
   */
  protected _state: CursorState = 'idle';

  /**
   * @internal
   */
  protected _currentPage?: { result: TRaw[] };

  /**
   * @internal
   */
  private _isNextPage = true;

  /**
   * @internal
   */
  readonly _mapping?: (doc: any) => T;

  /**
   * @internal
   */
  readonly _timeoutOptions: CommandOptions;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(options: CommandOptions, mapping?: (doc: any) => T) {
    this._timeoutOptions = options;
    this._mapping = mapping;
  }

  /**
   * ##### Overview
   *
   * Gets the current status of the cursor.
   *
   * See {@link CursorState} for more information on the possible states, and how they may be transitioned between each other.
   *
   * @example
   * ```ts
   * const cursor = collection.find({});
   * console.log(cursor.state); // 'idle'
   *
   * await cursor.next();
   * console.log(cursor.state); // 'started'
   *
   * cursor.close();
   * console.log(cursor.state); // 'closed'
   * ```
   *
   * @see CursorState
   */
  public get state(): CursorState {
    return this._state;
  }

  /**
   * ##### Overview
   *
   * Gets the number of raw records in the buffer.
   *
   * Unless the cursor was closed before the buffer was completely read, the total number of records retrieved from the
   * server is equal to (`consumed()` + `buffered()`).
   *
   * @example
   * ```ts
   * const cursor = collection.find({});
   * console.log(cursor.buffered()); // 0
   *
   * await cursor.next(); // Fetches a page of results
   * console.log(cursor.buffered()); // Number of records in buffer
   * ```
   *
   * @returns The number of raw records currently in the buffer.
   *
   * @see AbstractCursor.consumed
   */
  public buffered(): number {
    return this._currentPage?.result.length ?? 0;
  }

  /**
   * ##### Overview
   *
   * Gets the number of records that have been read by the user from the cursor.
   *
   * Unless the cursor was closed before the buffer was completely read, the total number of records retrieved from the
   * server is equal to (`consumed()` + `buffered()`).
   *
   * @example
   * ```ts
   * const cursor = collection.find({});
   * console.log(cursor.consumed()); // 0
   *
   * await cursor.next();
   * console.log(cursor.consumed()); // 1
   * ```
   *
   * @returns The number of records that have been read from the cursor.
   *
   * @see AbstractCursor.buffered
   */
  public consumed(): number {
    return this._consumed;
  }

  /**
   * ##### Overview
   *
   * Consumes up to `max` records from the buffer, or all records if `max` is not provided.
   *
   * > **⚠️Warning:** This actually consumes the buffer; it doesn't just peek at it.
   *
   * > **🚨Important:** The records returned from this method are not affected by `cursor.map()`.
   *
   * @example
   * ```ts
   * const cursor = collection.find({});
   * await cursor.next(); // Populates the buffer
   *
   * // Consume up to 5 records from the buffer
   * const records = cursor.consumeBuffer(5);
   * console.log(records.length); // Number of records consumed (up to 5)
   *
   * // Consume all remaining records
   * const remaining = cursor.consumeBuffer();
   * ```
   *
   * @param max - The optional max number of records to read from the buffer.
   *
   * @returns The records read from the buffer.
   */
  public consumeBuffer(max?: number): TRaw[] {
    const buffer = this._currentPage?.result ?? [];
    const ret = buffer.splice(0, max ?? buffer.length);
    this._consumed += ret.length;
    return ret;
  }

  /**
   * ##### Overview
   *
   * Closes the cursor. The cursor will be unusable after this method is called, or until {@link AbstractCursor.rewind} is called.
   *
   * @example
   * ```ts
   * const cursor = collection.find({});
   *
   * // Use the cursor
   * const doc = await cursor.next();
   *
   * // Close the cursor when done
   * cursor.close();
   *
   * // Attempting to use a closed cursor
   * await cursor.next(); // Throws CursorError
   * ```
   *
   * @see AbstractCursor.rewind - To reset a closed cursor to make it usable again
   */
  public close(): void {
    this._state = 'closed';
    this._currentPage = undefined;
    this._isNextPage = true;
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
   * const cursor = collection.find({ age: { $gt: 30 } }).sort({ name: 1 });
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
   * See {@link AbstractCursor.rewind} for more information on rewinding.
   *
   * @returns A new cursor with the same configuration as the current cursor.
   *
   * @see AbstractCursor.rewind
   */
  public abstract clone(): this;

  /**
   * ##### Overview
   *
   * Rewinds the cursor to its uninitialized state, clearing the buffer and any state.
   *
   * Any configuration set on the cursor will remain, but iteration will start from the beginning, sending new queries to the server, even if the resultant data was already fetched by the cursor.
   *
   * @example
   * ```ts
   * const cursor = collection.find({}).sort({ name: 1 });
   *
   * // Read some data
   * const first = await cursor.next();
   *
   * // Rewind the cursor
   * cursor.rewind();
   *
   * // Start again from the beginning
   * const firstAgain = await cursor.next();
   * // first and firstAgain are the same record
   * ```
   *
   * ---
   *
   * ##### Rewinding vs Cloning
   *
   * Rewinding a cursor is different from cloning it. Cloning creates an independent new cursor with the same state and configuration as the original, while rewinding resets the current cursor to its initial state.
   *
   * See {@link AbstractCursor.clone} for more information on cloning.
   *
   * @see AbstractCursor.clone
   */
  public rewind(): void {
    this._currentPage = undefined;
    this._isNextPage = true;
    this._state = 'idle';
    this._consumed = 0;
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
   * const cursor = table.find({ name: 'John' })
   *   .map(row => row.name);
   *   .map(name => name.toLowerCase());
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
  public abstract map<R>(map: (doc: T) => R): AbstractCursor<R, TRaw>;

  /**
   * ##### Overview
   *
   * An async iterator that lazily iterates over all records in the cursor.
   *
   * > **⚠️Warning:** There'll only be partial results if the cursor has been consumed prior. You may use {@link AbstractCursor.rewind} to reset the cursor.
   *
   * ---
   *
   * ##### Behavior
   *
   * - If the cursor is uninitialized, it will be initialized
   * - If the consumer `break`s, iteration will stop early
   * - If the cursor is closed, this method will throw a {@link CursorError}
   * - It will close the cursor when iteration is complete, even if it was broken early
   * - If no records are found, no error will be thrown, and the iterator will simply finish
   *
   * @example
   * ```ts
   * const cursor = collection.find({ age: { $gt: 30 } });
   *
   * // Iterate over all matching records
   * for await (const doc of cursor) {
   *   console.log(doc);
   *
   *   if (doc.name === 'John') {
   *     break; // Stop iteration early
   *   }
   * }
   *
   * // Cursor is now closed
   * console.log(cursor.state); // 'closed'
   * ```
   */
  public [Symbol.asyncIterator](): AsyncGenerator<T, void, void> {
    return this._iterator('[asyncIterator]');
  }

  /**
   * ##### Overview
   *
   * Fetches the next record from the cursor. Returns `null` if there are no more records to fetch.
   *
   * ---
   *
   * ##### Behavior
   *
   * - If the cursor is uninitialized, it will be initialized
   * - If the cursor is closed, this method will return `null`
   * - It will close the cursor when there are no more records to fetch
   * - If no records are found, no error will be thrown, and `null` will be returned
   *
   * @example
   * ```ts
   * const cursor = collection.find({ name: 'John' });
   *
   * // Get the first record
   * const john = await cursor.next();
   *
   * // Get the next record (or null if no more records)
   * const nextRecord = await cursor.next();
   *
   * // Exhaust the cursor
   * let doc;
   * while ((doc = await cursor.next()) !== null) {
   *   console.log(doc);
   * }
   * ```
   *
   * @returns The next record, or `null` if there are no more records.
   */
  public async next(): Promise<T | null> {
    return this._next(false, '.next');
  }

  /**
   * ##### Overview
   *
   * Tests if there is a next record in the cursor.
   *
   * ---
   *
   * ##### Behavior
   *
   * - If the cursor is uninitialized, it will be initialized
   * - If the cursor is closed, this method will return `false`
   * - It will close the cursor when there are no more records to fetch
   *
   * @example
   * ```ts
   * const cursor = collection.find({ name: 'John' });
   *
   * // Check if there are any records
   * if (await cursor.hasNext()) {
   *   const john = await cursor.next();
   *   console.log(john);
   * }
   *
   * // Use in a loop
   * while (await cursor.hasNext()) {
   *   const record = await cursor.next();
   *   console.log(record);
   * }
   * ```
   *
   * @returns Whether or not there is a next record.
   */
  public async hasNext(): Promise<boolean> {
    return await this._next(true, '.hasNext') !== null;
  }

  /**
   * ##### Overview
   *
   * Iterates over all records in the cursor, calling the provided consumer for each record.
   *
   * > **⚠️Warning:** There'll only be partial results if the cursor has been consumed prior. You may use {@link AbstractCursor.rewind} to reset the cursor.
   *
   * > **✏️Note:** If you get an IDE error "Promise returned from forEach argument is ignored", you may simply ignore it. It is a [known WebStorm bug](https://youtrack.jetbrains.com/issue/WEB-55512/False-positive-for-Promise-returned-from-forEach-argument-is-ignored-with-custom-forEach-function).
   *
   * ---
   *
   * ##### Behavior
   *
   * - If the cursor is uninitialized, it will be initialized
   * - If the consumer returns `false` or `Promise<false>`, iteration will stop early
   * - If the cursor is closed, this method will throw a {@link CursorError}
   * - It will close the cursor when iteration is complete, even if it was stopped early
   * - If no records are found, no error will be thrown, and the iterator will simply finish
   *
   * @example
   * ```ts
   * const cursor = collection.find({ age: { $gt: 30 } });
   *
   * // Process all records
   * await cursor.forEach((doc) => {
   *   console.log(doc);
   * });
   *
   * // Process records until a condition is met
   * await cursor.forEach(async (doc) => {
   *   if (await isSpecial(doc)) {
   *     return false;
   *   }
   * });
   * ```
   *
   * @param consumer - The consumer to call for each record. Return `false` to stop iteration.
   *
   * @returns A promise that resolves when iteration is complete.
   */
  public async forEach(consumer: ((doc: T) => boolean | Promise<boolean>) | ((doc: T) => void | Promise<void>)): Promise<void> {
    for await (const doc of this._iterator('.forEach')) {
      const resp = consumer(doc);
      const stop = (resp === undefined) ? resp : await resp;

      if (stop === false) {
        break;
      }
    }
  }

  /**
   * ##### Overview
   *
   * Returns an array of all matching records in the cursor.
   *
   * > **⚠️Warning:** The user should ensure that there is enough memory to store all records in the cursor.
   *
   * > **⚠️Warning:** There'll only be partial results if the cursor has been consumed prior. You may use {@link AbstractCursor.rewind} to reset the cursor.
   *
   * ---
   *
   * ##### Behavior
   *
   * - If the cursor is uninitialized, it will be initialized
   * - If the cursor is closed, this method will throw a {@link CursorError}
   * - It will close the cursor when fetching is complete
   * - If no records are found, no error will be thrown, and an empty array will be returned
   *
   * @example
   * ```ts
   * const cursor = collection.find({ department: 'Engineering' });
   *
   * // Get all matching records as an array
   * const engineers = await cursor.toArray();
   * console.log(`Found ${engineers.length} engineers`);
   *
   * // For a large result set, consider using lazy iteration instead
   * for await (const doc of cursor.rewind()) {
   *   // Process one document at a time
   * }
   * ```
   *
   * @returns An array of all records in the cursor.
   */
  public async toArray(): Promise<T[]> {
    const docs: T[] = [];
    const tm = this._tm().multipart('generalMethodTimeoutMs', this._timeoutOptions);

    for await (const doc of this._iterator('.toArray', tm)) {
      docs.push(doc);
    }

    return docs;
  }

  /**
   * @internal
   */
  protected abstract _fetchNextPage(extra: Record<string, unknown>, tm: TimeoutManager | undefined): Promise<[page: typeof this._currentPage, isNextPage: boolean]>;

  /**
   * @internal
   */
  protected abstract _tm(): Timeouts;

  /**
   * @internal
   */
  private async* _iterator(method: string, tm?: TimeoutManager): AsyncGenerator<T, void, void> {
    if (this._state === 'closed') {
      throw new CursorError('Cannot iterate over a closed cursor', this);
    }

    try {
      for (let doc: T | null; (doc = await this._next(false, method, tm));) {
        yield doc;
      }
    } finally {
      this.close();
    }
  }

  /**
   * @internal
   */
  public async _next(peek: true, method: string, tm?: TimeoutManager): Promise<true | null>

  /**
   * @internal
   */
  public async _next(peek: false, method: string, tm?: TimeoutManager): Promise<T | null>

  /**
   * @internal
   */
  public async _next(peek: boolean, method: string, tm?: TimeoutManager): Promise<T | boolean | null> {
    if (this._state === 'closed') {
      return null;
    }

    try {
      this._state = 'started';

      while (!this._currentPage?.result.length) {
        if (!this._isNextPage) {
          this.close();
          return null;
        }

        [this._currentPage, this._isNextPage] = await this._fetchNextPage({ method }, tm);
      }

      if (peek) {
        return true;
      }

      const doc = this._currentPage.result.shift();

      if (doc) {
        this._consumed++;
      }

      return (doc && this._mapping)
        ? this._mapping(doc)
        : doc as T;
    } catch (e) {
      this.close();
      throw e;
    }
  }

  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - `.bufferedCount()` has been renamed to simply be `.buffered()`.
   */
  public declare bufferedCount: 'ERROR: `.bufferedCount()` has been renamed to be simply `.buffered()`';

  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - `.readBufferedDocuments()` has been renamed to be `.consumeBuffer()`.
   */
  public declare readBufferedDocuments: 'ERROR: `.readBufferedDocuments()` has been renamed to be `.consumeBuffer()`';
}
