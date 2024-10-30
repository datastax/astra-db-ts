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

import { $SerializeForTables } from '@/src/documents/tables/ser-des';
import { $CustomInspect } from '@/src/lib/constants';

type CqlBlobLike = ArrayBuffer | Buffer | string;

export class CqlBlob {
  readonly #raw: CqlBlobLike;

  public [$SerializeForTables] = this.asBase64;

  private constructor(blob: CqlBlobLike) {
    this.#raw = blob;

    Object.defineProperty(this, $CustomInspect, {
      value: this.toString(),
    });
  }

  public static fromArrayBuffer(buffer: ArrayBuffer): CqlBlob {
    return new CqlBlob(buffer);
  }

  public static fromBuffer(buffer: Buffer): CqlBlob {
    return new CqlBlob(buffer);
  }

  public static fromBase64(base64: string): CqlBlob {
    return new CqlBlob(base64);
  }

  public asArrayBuffer(): ArrayBuffer {
    if (this.#raw instanceof ArrayBuffer) {
      return this.#raw;
    }

    if (this.#raw instanceof Buffer) {
      return this.#raw.buffer;
    }

    return base64ToArrayBuffer(this.#raw);
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

    return Buffer.from(this.#raw, 'base64');
  }

  public asBase64(): string {
    if (this.#raw instanceof ArrayBuffer) {
      return arrayBufferToBase64(this.#raw);
    }

    if (this.#raw instanceof Buffer) {
      return this.#raw.toString('base64');
    }

    return this.#raw;
  }

  public toString() {
    const type = (this.#raw instanceof ArrayBuffer && 'ArrayBuffer') || (this.#raw instanceof Buffer && 'Buffer') || 'base64';
    return `CqlBlob(typeof raw=${type})`;
  }
}

const base64ToArrayBuffer =
  (typeof Buffer !== 'undefined')
    ? nodeBase64ToArrayBuffer :
  (typeof window !== 'undefined')
    ? webBase64ToArrayBuffer
    : panicBase64ToArrayBuffer;

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
  return Buffer.from(base64, 'base64').buffer;
}

function panicBase64ToArrayBuffer(): ArrayBuffer {
  throw new Error("Cannot convert base64 to ArrayBuffer in this environment");
}

const arrayBufferToBase64 =
  (typeof Buffer !== 'undefined')
    ? nodeArrayBufferToBase64 :
  (typeof window !== 'undefined')
    ? webArrayBufferToBase64
    : panicArrayBufferToBase64;

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

function panicArrayBufferToBase64(): string {
  throw new Error("Cannot convert ArrayBuffer to base64 in this environment");
}
