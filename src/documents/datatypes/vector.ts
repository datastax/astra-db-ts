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

import { $SerializeForCollection } from '@/src/documents/collections/ser-des';
import { $SerializeForTable } from '@/src/documents/tables/ser-des';
import { $CustomInspect } from '@/src/lib/constants';

export type DataAPIVectorLike = number[] | { $binary: string } | Float32Array | DataAPIVector;

export class DataAPIVector {
  readonly #vector: Exclude<DataAPIVectorLike, DataAPIVector>;

  public [$SerializeForTable]: () => { $binary: string } | number[];
  public [$SerializeForCollection]: () => { $binary: string } | number[];

  public constructor(vector: DataAPIVectorLike, validate = true) {
    if (validate && !DataAPIVector.isVectorLike(vector)) {
      throw new Error(`Invalid vector type; expected number[], base64 string, Float32Array, or DataAPIVector; got '${vector}'`);
    }

    this.#vector = (vector instanceof DataAPIVector)
      ? vector.raw()
      : vector;

    this[$SerializeForTable] = () => serialize(this.#vector);
    this[$SerializeForCollection] = this[$SerializeForTable];

    Object.defineProperty(this, $CustomInspect, {
      value: this.toString,
    });
  }

  public get length(): number {
    if ('$binary' in this.#vector) {
      return ~~((this.#vector.$binary.replace(/=+$/, "").length * 3) / 4 / 4);
    }
    return this.#vector.length;
  }

  public raw(): Exclude<DataAPIVectorLike, DataAPIVector> {
    return this.#vector;
  }

  public asArray(): number[] {
    if (this.#vector instanceof Float32Array) {
      return Array.from(this.#vector);
    }

    if ('$binary' in this.#vector) {
      const deserialized = deserializeToNumberArray(this.#vector.$binary);

      if (!deserialized) {
        throw new Error('Could not to deserialize vector from base64 => number[]; unknown environment. Please manually deserialize the binary from `vector.getAsBase64()`');
      }

      return deserialized;
    }

    return this.#vector;
  }

  public asFloat32Array(): Float32Array {
    if (this.#vector instanceof Float32Array) {
      return this.#vector;
    }

    if ('$binary' in this.#vector) {
      const deserialized =  deserializeToF32Array(this.#vector.$binary);

      if (!deserialized) {
        throw new Error('Could not to deserialize vector from base64 => Float32Array; unknown environment. Please manually deserialize the binary from `vector.getAsBase64()`');
      }

      return deserialized;
    }

    return new Float32Array(this.#vector);
  }

  public asBase64(): string {
    const serialized = serialize(this.#vector);

    if (!('$binary' in serialized)) {
      if (Array.isArray(this.#vector)) {
        throw new Error('Could not serialize vector from number[] => base64; unknown environment. Please manually serialize the binary from `vector.getRaw()`/`vector.getAsArray()`');
      } else {
        throw new Error('Could not serialize vector from Float32Array => base64; unknown environment. Please manually serialize the binary from `vector.getRaw()`/`vector.getAsFloat32Array()`');
      }
    }

    return serialized.$binary;
  }

  public toString(): string {
    const type = ('$binary' in this.#vector && 'base64') || (this.#vector instanceof Float32Array && 'Float32Array') || 'number[]';

    const partial = ('$binary' in this.#vector)
      ? `'${this.#vector.$binary.slice(0, 12)}${this.#vector.$binary.length > 12 ? '...' : ''}'`
      : `[${this.#vector.slice(0, 2).join(', ')}${this.#vector.length > 2 ? ', ...' : ''}]`;

    return `DataAPIVector<${this.length}>(typeof raw=${type}, preview=${partial})`;
  }

  public static isVectorLike(value: unknown): value is DataAPIVectorLike {
    return !!value && typeof value === 'object' && (Array.isArray(value) || value instanceof Float32Array || ('$binary' in value && typeof value.$binary === 'string') || value instanceof DataAPIVector);
  }
}

const serialize = (vector: Exclude<DataAPIVectorLike, DataAPIVector>): { $binary: string } | number[] => {
  if ('$binary' in vector) {
    return vector;
  }

  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.allocUnsafe(vector.length * 4);

    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatBE(vector[i], i * 4);
    }

    return { $binary: buffer.toString('base64') };
  }

  if (typeof window !== 'undefined' && window.btoa) {
    const buffer = new Uint8Array(vector.length * 4);
    const view = new DataView(buffer.buffer);

    for (let i = 0; i < vector.length; i++) {
      view.setFloat32(i * 4, vector[i], false);
    }

    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }

    return { $binary: window.btoa(binary) };
  }

  if (vector instanceof Float32Array) {
    return Array.from(vector);
  }

  return vector;
};

const deserializeToNumberArray = (serialized: string): number[] | undefined => {
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(serialized, 'base64');
    const vector = Array.from<number>({ length: buffer.length / 4 });

    for (let i = 0; i < vector.length; i++) {
      vector[i] = buffer.readFloatBE(i * 4);
    }

    return vector;
  }

  const deserialized = deserializeToF32Array(serialized);

  if (deserialized) {
    return Array.from(deserialized);
  }

  return undefined;
};

const deserializeToF32Array = (serialized: string): Float32Array | undefined => {
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(serialized, 'base64');
    const vector = new Float32Array(buffer.length / 4);

    for (let i = 0; i < vector.length; i++) {
      vector[i] = buffer.readFloatBE(i * 4);
    }

    return vector;
  }

  if (typeof window !== 'undefined') {
    const binary = window.atob(serialized);
    const buffer = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }

    return new Float32Array(buffer.buffer);
  }

  return undefined;
};
