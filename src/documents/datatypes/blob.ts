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

import { $CustomInspect } from '@/src/lib/constants';
import { TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { forJSEnv } from '@/src/lib/utils';

/**
 * Represents any type that can be converted into a {@link DataAPIBlob}
 *
 * @public
 */
export type DataAPIBlobLike = DataAPIBlob | ArrayBuffer | Buffer | { $binary: string };

/**
 * A shorthand function for `new DataAPIBlob(blob)`
 *
 * @public
 */
export const blob = (blob: DataAPIBlobLike) => new DataAPIBlob(blob);

/**
 * Represents a `blob` column for Data API tables.
 *
 * See {@link DataAPIBlobLike} for the types that can be converted into a `DataAPIBlob`.
 *
 * You may use the {@link blob} function as a shorthand for creating a new `DataAPIBlob`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPIBlob implements TableCodec<typeof DataAPIBlob> {
  private readonly _raw!: Exclude<DataAPIBlobLike, DataAPIBlob>;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done({ $binary: this.asBase64() });
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](_: unknown, value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPIBlob((ctx.parsingInsertedId) ? { $binary: value } : value, false));
  }

  /**
   * Creates a new `DataAPIBlob` instance from a blob-like value.
   *
   * You can set `validate` to `false` to bypass any validation if you're confident the value is a valid blob.
   *
   * @param blob - The blob-like value to convert to a `DataAPIBlob`
   * @param validate - Whether to validate the blob-like value (default: `true`)
   *
   * @throws TypeError If `blob` is not a valid blob-like value
   */
  public constructor(blob: DataAPIBlobLike, validate = true) {
    if (validate && !DataAPIBlob.isBlobLike(blob)) {
      throw new TypeError(`Expected blob to be a string, ArrayBuffer, or Buffer (got '${blob}')`);
    }

    Object.defineProperty(this, '_raw', {
      value: (blob instanceof DataAPIBlob)
        ? blob._raw
        : blob,
    });

    Object.defineProperty(this, $CustomInspect, {
      value: this.toString,
    });
  }

  /**
   * Gets the byte length of the blob, agnostic of the underlying type.
   *
   * @returns The byte length of the blob
   */
  public get byteLength(): number {
    if (this._raw instanceof ArrayBuffer) {
      return this._raw.byteLength;
    }

    if (this._raw instanceof Buffer) {
      return this._raw.length;
    }

    return ~~((this._raw.$binary.replace(/=+$/, '').length * 3) / 4);
  }

  /**
   * Gets the raw underlying implementation of the blob.
   *
   * @returns The raw blob
   */
  public raw(): Exclude<DataAPIBlobLike, DataAPIBlob> {
    return this._raw;
  }

  /**
   * Returns the blob as an `ArrayBuffer`, converting between types if necessary.
   *
   * @returns The blob as an `ArrayBuffer`
   */
  public asArrayBuffer(): ArrayBuffer {
    if (this._raw instanceof ArrayBuffer) {
      return this._raw;
    }

    if (this._raw instanceof Buffer) {
      return bufferToArrayBuffer(this._raw);
    }

    return base64ToArrayBuffer(this._raw.$binary);
  }

  /**
   * Returns the blob as a `Buffer`, if available, converting between types if necessary.
   *
   * @returns The blob as a `Buffer`
   */
  public asBuffer(): Buffer {
    if (typeof Buffer === 'undefined') {
      throw new Error("Buffer is not available in this environment");
    }

    if (this._raw instanceof Buffer) {
      return this._raw;
    }

    if (this._raw instanceof ArrayBuffer) {
      return Buffer.from(this._raw);
    }

    return Buffer.from(this._raw.$binary, 'base64');
  }

  /**
   * Returns the blob as a base64 string, converting between types if necessary.
   *
   * @returns The blob as a base64 string
   */
  public asBase64(): string {
    if (this._raw instanceof ArrayBuffer) {
      return arrayBufferToBase64(this._raw);
    }

    if ('$binary' in this._raw) {
      return this._raw.$binary;
    }

    return this._raw.toString('base64');
  }

  /**
   * Returns a pretty string representation of the `DataAPIBlob`.
   */
  public toString() {
    const type = (this._raw instanceof ArrayBuffer && 'ArrayBuffer') || (this._raw instanceof Buffer && 'Buffer') || 'base64';
    return `DataAPIBlob(typeof raw=${type}, byteLength=${this.byteLength})`;
  }

  /**
   * Determines whether the given value is a blob-like value (i.e. it's {@link DataAPIBlobLike}.
   *
   * @param value - The value to check
   *
   * @returns `true` if the value is a blob-like value; `false` otherwise
   */
  public static isBlobLike(value: unknown): value is DataAPIBlobLike {
    return !!value && typeof value === 'object' && (value instanceof DataAPIBlob || ('$binary' in value && typeof value.$binary === 'string') || value instanceof ArrayBuffer || value instanceof Buffer);
  }
}

const base64ToArrayBuffer = forJSEnv<(base64: string) => ArrayBuffer>({
  server: (base64) => {
    return bufferToArrayBuffer(Buffer.from(base64, 'base64'));
  },
  browser: (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  },
  unknown: () => {
    throw new Error("Cannot convert base64 to Buffer/ArrayBuffer in this environment; please do so manually");
  },
});

const arrayBufferToBase64 = forJSEnv<(buffer: ArrayBuffer) => string>({
  server: (buffer) => {
    return Buffer.from(buffer).toString('base64');
  },
  browser: (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },
  unknown: () => {
    throw new Error("Cannot convert Buffer/ArrayBuffer to base64 in this environment; please do so manually");
  },
});

function bufferToArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
