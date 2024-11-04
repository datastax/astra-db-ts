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

import { $SerializeForCollections } from '@/src/documents/collections/ser-des';
import { $SerializeForTables } from '@/src/documents/tables/ser-des';
import { $CustomInspect } from '@/src/lib/constants';

export type DataAPIVectorLike = number[] | string | Float32Array | DataAPIVector;

export class DataAPIVector {
  readonly #vector: Exclude<DataAPIVectorLike, DataAPIVector>;

  public [$SerializeForTables] = () => DataAPIVector.#serialize(this.#vector);
  public [$SerializeForCollections] = this[$SerializeForTables];

  public constructor(vector: DataAPIVectorLike, validate = true) {
    if (validate) {
      if (!Array.isArray(vector) && !(<any>vector instanceof DataAPIVector) && typeof vector !== 'string' && !(vector instanceof Float32Array)) {
        throw new Error(`Invalid vector type; expected number[], base64 string, Float32Array, or DataAPIVector; got '${vector}'`);
      }
    }

    this.#vector = (vector instanceof DataAPIVector)
      ? vector.raw()
      : vector;

    Object.defineProperty(this, $CustomInspect, {
      value: this.toString,
    });
  }

  public get length(): number {
    if (typeof this.#vector === 'string') {
      return ~~((this.#vector.replace(/=+$/, "").length * 3) / 4 / 4);
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

    if (typeof this.#vector === 'string') {
      const deserialized = DataAPIVector.#deserializeToNumberArray(this.#vector);

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

    if (typeof this.#vector === 'string') {
      const deserialized =  DataAPIVector.#deserializeToF32Array(this.#vector);

      if (!deserialized) {
        throw new Error('Could not to deserialize vector from base64 => Float32Array; unknown environment. Please manually deserialize the binary from `vector.getAsBase64()`');
      }

      return deserialized;
    }

    return new Float32Array(this.#vector);
  }

  public asBase64(): string {
    const serialized = DataAPIVector.#serialize(this.#vector);

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
    const type = (typeof this.#vector === 'string' && 'string') || (this.#vector instanceof Float32Array && 'Float32Array') || 'number[]';

    const partial = (typeof this.#vector === 'string')
      ? `'${this.#vector.slice(0, 12)}${this.#vector.length > 12 ? '...' : ''}'`
      : `[${this.#vector.slice(0, 2).join(', ')}${this.#vector.length > 2 ? ', ...' : ''}]`;

    return `DataAPIVector<${this.length}>(typeof raw=${type}, preview=${partial})`;
  }

  static #serialize(vector: Exclude<DataAPIVectorLike, DataAPIVector>): { $binary: string } | number[] {
    if (typeof vector === 'string') {
      return { $binary: vector };
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
  }

  static #deserializeToNumberArray(serialized: string): number[] | undefined {
    if (typeof Buffer !== 'undefined') {
      const buffer = Buffer.from(serialized, 'base64');
      const vector = Array.from<number>({ length: buffer.length / 4 });

      for (let i = 0; i < vector.length; i++) {
        vector[i] = buffer.readFloatBE(i * 4);
      }

      return vector;
    }

    const deserialized = DataAPIVector.#deserializeToF32Array(serialized);

    if (deserialized) {
      return Array.from(deserialized);
    }

    return undefined;
  }

  static #deserializeToF32Array(serialized: string): Float32Array | undefined {
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
  }
}
