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
import { DataAPIError } from '@/src/documents/errors.js';
import type { TimeoutManager, Timeouts, WithTimeout } from '@/src/lib/api/timeouts/timeouts.js';
import { QueryState } from '@/src/lib/utils.js';

/**
 * An exception that may be thrown whenever something goes wrong with a cursor.
 *
 * @public
 */
export class CursorError extends DataAPIError {
  /**
   * The underlying cursor which caused this error.
   */
  public readonly cursor: AbstractCursor<unknown>;

  /**
   * The status of the cursor when the error occurred.
   */
  public readonly state: CursorState;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  constructor(message: string, cursor: AbstractCursor<unknown>) {
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
export type CursorState = 'idle' | 'started' | 'closed';

export abstract class AbstractCursor<T, TRaw extends SomeDoc = SomeDoc> {
  /**
   * @internal
   */
  private _consumed = 0;

  /**
   * @internal
   */
  private _buffer: TRaw[] = [];

  /**
   * @internal
   */
  protected _state: CursorState = 'idle';

  /**
   * @internal
   */
  protected _nextPageState = new QueryState<string>();

  /**
   * @internal
   */
  readonly _mapping?: (doc: any) => T;

  /**
   * @internal
   */
  readonly _options: WithTimeout<'generalMethodTimeoutMs'>;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(options: WithTimeout<'generalMethodTimeoutMs'>, mapping?: (doc: any) => T) {
    this._options = options;
    this._mapping = mapping;
  }

  /**
   * The current status of the cursor.
   */
  public get state(): CursorState {
    return this._state;
  }

  /**
   * The number of raw records in the buffer.
   *
   * Unless the cursor was closed before the buffer was completely read, the total number of records retrieved from the
   * server is equal to ({@link FindCursor.consumed} + {@link FindCursor.buffered}).
   */
  public buffered(): number {
    return this._buffer.length;
  }

  /**
   * The number of records that have been read be the user from the cursor.
   *
   * Unless the cursor was closed before the buffer was completely read, the total number of records retrieved from the
   * server is equal to ({@link FindCursor.consumed} + {@link FindCursor.buffered}).
   */
  public consumed(): number {
    return this._consumed;
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
    const ret = this._buffer.splice(0, max ?? this._buffer.length);
    this._consumed += ret.length;
    return ret;
  }

  /**
   * Rewinds the cursor to its uninitialized state, clearing the buffer and any state.
   *
   * Any configuration set on the cursor will remain, but iteration will start from the beginning, sending new queries
   * to the server, even if the resultant data was already fetched by this cursor.
   */
  public rewind(): void {
    this._buffer.length = 0;
    this._nextPageState = new QueryState<string>();
    this._state = 'idle';
    this._consumed = 0;
  }

  /**
   * Closes the cursor. The cursor will be unusable after this method is called, or until {@link FindCursor.rewind} is called.
   */
  public close(): void {
    this._state = 'closed';
    this._buffer.length = 0;
  }

  public abstract clone(): this;

  public abstract map<R>(map: (doc: T) => R): AbstractCursor<R, TRaw>;

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
  public [Symbol.asyncIterator](): AsyncGenerator<T, void, void> {
    return this._iterator('[asyncIterator]');
  }

  /**
   * Fetches the next record from the cursor. Returns `null` if there are no more records to fetch.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `null`.
   *
   * @returns The next record, or `null` if there are no more records.
   */
  public next(): Promise<T | null> {
    return this._next(false, '.next');
  }

  /**
   * Tests if there is a next record in the cursor.
   *
   * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `false`.
   *
   * @returns Whether or not there is a next record.
   */
  public async hasNext(): Promise<boolean> {
    return await this._next(true, '.hasNext') !== null;
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
   *
   * @remarks
   * If you get an IDE error "Promise returned from forEach argument is ignored", it is a known [WebStorm bug](https://youtrack.jetbrains.com/issue/WEB-55512/False-positive-for-Promise-returned-from-forEach-argument-is-ignored-with-custom-forEach-function).
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
    const tm = this._tm().multipart('generalMethodTimeoutMs', this._options);

    for await (const doc of this._iterator('.toArray', tm)) {
      docs.push(doc);
    }

    return docs;
  }

  /**
   * @internal
   */
  protected abstract _nextPage(extra: Record<string, unknown>, tm: TimeoutManager | undefined): Promise<TRaw[]>;

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
  protected async _next(peek: true, method: string, tm?: TimeoutManager): Promise<boolean>

  /**
   * @internal
   */
  protected async _next(peek: false, method: string, tm?: TimeoutManager): Promise<T | null>

  /**
   * @internal
   */
  protected async _next(peek: boolean, method: string, tm?: TimeoutManager): Promise<T | boolean | null> {
    if (this._state === 'closed') {
      return null;
    }

    try {
      while (this._buffer.length === 0) {
        if (this._nextPageState.isNotFound()) {
          this.close();
          return null;
        }
        this._buffer = await this._nextPage({ method }, tm);
      }

      if (peek) {
        return this._buffer.length > 1;
      }

      this._state = 'started';
      const doc = this._buffer.shift() ?? null;

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
}
