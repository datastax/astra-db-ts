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

export type DataAPIBlobLike = DataAPIBlob | ArrayBuffer | Buffer | { $binary: string };

export const blob = (blob: DataAPIBlobLike) => new DataAPIBlob(blob);

export class DataAPIBlob implements TableCodec<typeof DataAPIBlob> {
  readonly #raw: Exclude<DataAPIBlobLike, DataAPIBlob>;

  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done({ $binary: this.asBase64() });
  };

  public static [$DeserializeForTable](value: any, ctx: TableDesCtx) {
    return new DataAPIBlob((ctx.parsingPrimaryKey) ? { $binary: value } : value, false);
  }

  public constructor(blob: DataAPIBlobLike, validate = true) {
    if (validate && !DataAPIBlob.isBlobLike(blob)) {
      throw new TypeError(`Expected blob to be a string, ArrayBuffer, or Buffer (got '${blob}')`);
    }

    this.#raw = (blob instanceof DataAPIBlob)
      ? blob.#raw
      : blob;

    Object.defineProperty(this, $CustomInspect, {
      value: this.toString,
    });
  }

  public get byteLength(): number {
    if (this.#raw instanceof ArrayBuffer) {
      return this.#raw.byteLength;
    }

    if (this.#raw instanceof Buffer) {
      return this.#raw.length;
    }

    return ~~((this.#raw.$binary.replace(/=+$/, '').length * 3) / 4);
  }

  public raw(): Exclude<DataAPIBlobLike, DataAPIBlob> {
    return this.#raw;
  }

  public asArrayBuffer(): ArrayBuffer {
    if (this.#raw instanceof ArrayBuffer) {
      return this.#raw;
    }

    if (this.#raw instanceof Buffer) {
      return bufferToArrayBuffer(this.#raw);
    }

    return base64ToArrayBuffer(this.#raw.$binary);
  }

  public asBuffer(): Buffer {
    if (typeof Buffer === 'undefined') {
      throw new Error("Buffer is not available in this environment");
    }

    if (this.#raw instanceof Buffer) {
      return this.#raw;
    }

    if (this.#raw instanceof ArrayBuffer) {
      return Buffer.from(this.#raw);
    }

    return Buffer.from(this.#raw.$binary, 'base64');
  }

  public asBase64(): string {
    if (this.#raw instanceof ArrayBuffer) {
      return arrayBufferToBase64(this.#raw);
    }

    if (this.#raw instanceof Buffer) {
      return this.#raw.toString('base64');
    }

    return this.#raw.$binary;
  }

  public toString() {
    const type = (this.#raw instanceof ArrayBuffer && 'ArrayBuffer') || (this.#raw instanceof Buffer && 'Buffer') || 'base64';
    return `DataAPIBlob(typeof raw=${type}, byteLength=${this.byteLength})`;
  }

  public static isBlobLike(value: unknown): value is DataAPIBlobLike {
    return !!value && typeof value === 'object' && (value instanceof DataAPIBlob || ('$binary' in value && typeof value.$binary === 'string') || value instanceof ArrayBuffer || value instanceof Buffer);
  }
}

const base64ToArrayBuffer =
  (typeof Buffer !== 'undefined')
    ? nodeBase64ToArrayBuffer :
  (typeof window !== 'undefined')
    ? webBase64ToArrayBuffer
    : panicBase64ToBuffer;

function webBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function nodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  return bufferToArrayBuffer(Buffer.from(base64, 'base64'));
}

function panicBase64ToBuffer(): ArrayBuffer {
  throw new Error("Cannot convert base64 to Buffer/ArrayBuffer in this environment; please do so manually");
}

const arrayBufferToBase64 =
  (typeof Buffer !== 'undefined')
    ? nodeArrayBufferToBase64 :
  (typeof window !== 'undefined')
    ? webArrayBufferToBase64
    : panicBufferToBase64;

function webArrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function nodeArrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

function panicBufferToBase64(): string {
  throw new Error("Cannot convert Buffer/ArrayBuffer to base64 in this environment; please do so manually");
}

function bufferToArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
