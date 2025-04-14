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

import { $CustomInspect } from '@/src/lib/constants.js';
import type { TableDesCtx, TableSerCtx } from '@/src/documents/index.js';
import type { CollectionDesCtx, CollectionSerCtx } from '@/src/documents/index.js';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { forJSEnv } from '@/src/lib/utils.js';
import { betterTypeOf } from '@/src/documents/utils.js';
import type { DataAPICodec } from '@/src/lib/index.js';

/**
 * Represents any type that can be converted into a {@link DataAPIVector}
 *
 * @public
 */
export type DataAPIVectorLike = number[] | { $binary: string } | Float32Array | DataAPIVector;

/**
 * A shorthand function for `new DataAPIVector(vector)`
 *
 * @public
 */
export const vector = (v: DataAPIVectorLike) => (v instanceof DataAPIVector) ? v : new DataAPIVector(v);

/**
 * Represents a `vector` column for Data API tables.
 *
 * See {@link DataAPIVectorLike} for the types that can be converted into a `DataAPIVector`.
 *
 * You may use the {@link vector} function as a shorthand for creating a new `DataAPIVector`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPIVector implements DataAPICodec<typeof DataAPIVector> {
  private readonly _vector!: Exclude<DataAPIVectorLike, DataAPIVector>;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this.serialize());
  };

  /**
   * Implementation of `$SerializeForCollection` for {@link TableCodec}
   */
  public [$SerializeForCollection](ctx: CollectionSerCtx) {
    return ctx.done(this.serialize());
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPIVector(value, false));
  }

  /**
   * Implementation of `$DeserializeForCollection` for {@link TableCodec}
   */
  public static [$DeserializeForCollection](value: any, ctx: CollectionDesCtx) {
    return ctx.done(new DataAPIVector(value, false));
  }

  /**
   * Creates a new `DataAPIVector` instance from a vector-like value.
   *
   * You can set `validate` to `false` to bypass any validation if you're confident the value is a valid vector.
   *
   * @param vector - The vector-like value to convert to a `DataAPIVector`
   * @param validate - Whether to validate the vector-like value (default: `true`)
   *
   * @throws TypeError If `vector` is not a valid vector-like value
   */
  public constructor(vector: DataAPIVectorLike, validate = true) {
    if (validate && !DataAPIVector.isVectorLike(vector)) {
      throw new Error(`Invalid vector type; expected number[], { $binary: string }, Float32Array, or DataAPIVector; got '${betterTypeOf(vector)}'`);
    }

    Object.defineProperty(this, '_vector', {
      value: (vector instanceof DataAPIVector)
        ? vector.raw()
        : vector,
    });

    Object.defineProperty(this, $CustomInspect, {
      value: this.toString.bind(this),
    });
  }

  /**
   * Returns the length of the vector (# of floats), agnostic of the underlying type.
   *
   * @returns The length of the vector
   */
  public get length(): number {
    if ('$binary' in this._vector) {
      return ~~((this._vector.$binary.replace(/=+$/, '').length * 3) / 4 / 4);
    }
    return this._vector.length;
  }

  /**
   * Gets the raw underlying implementation of the vector.
   *
   * @returns The raw vector
   */
  public raw(): Exclude<DataAPIVectorLike, DataAPIVector> {
    return this._vector;
  }

  /**
   * Returns the vector as a `number[]`, converting between types if necessary.
   *
   * @returns The vector as a `number[]`
   */
  public asArray(): number[] {
    if (this._vector instanceof Float32Array) {
      return Array.from(this._vector);
    }

    if ('$binary' in this._vector) {
      const deserialized = deserializeToNumberArray(this._vector.$binary);

      if (!deserialized) {
        throw new Error('Could not to deserialize vector from base64 => number[]; unknown environment. Please manually deserialize the binary from `vector.getAsBase64()`');
      }

      return deserialized;
    }

    return this._vector;
  }

  /**
   * Returns the vector as a `Float32Array`, converting between types if necessary.
   *
   * @returns The vector as a `Float32Array`
   */
  public asFloat32Array(): Float32Array {
    if (this._vector instanceof Float32Array) {
      return this._vector;
    }

    if ('$binary' in this._vector) {
      const deserialized = deserializeToF32Array(this._vector.$binary);

      if (!deserialized) {
        throw new Error('Could not to deserialize vector from base64 => Float32Array; unknown environment. Please manually deserialize the binary from `vector.getAsBase64()`');
      }

      return deserialized;
    }

    return new Float32Array(this._vector);
  }

  /**
   * Returns the vector as a base64 string, converting between types if necessary.
   *
   * @returns The vector as a base64 string
   */
  public asBase64(): string {
    const serialized = this.serialize();

    if (!('$binary' in serialized)) {
      if (Array.isArray(this._vector)) {
        throw new Error('Could not convert vector from number[] => base64; unknown environment. Please manually serialize the binary from `vector.raw()`/`vector.getAsArray()`');
      } else {
        throw new Error('Could not convert vector from Float32Array => base64; unknown environment. Please manually serialize the binary from `vector.raw()`/`vector.getAsFloat32Array()`');
      }
    }

    return serialized.$binary;
  }

  /**
   * Returns a pretty string representation of the `DataAPIVector`.
   */
  public toString(): string {
    const type = ('$binary' in this._vector && 'base64') || (this._vector instanceof Float32Array && 'Float32Array') || 'number[]';

    const partial = ('$binary' in this._vector)
      ? `"${this._vector.$binary.slice(0, 12)}${this._vector.$binary.length > 12 ? '...' : ''}"`
      : `[${this._vector.slice(0, 2).join(', ')}${this._vector.length > 2 ? ', ...' : ''}]`;

    return `DataAPIVector<${this.length}>(typeof raw=${type}, preview=${partial})`;
  }

  /**
   * Determines whether the given value is a vector-like value (i.e. it's {@link DataAPIVectorLike}).
   *
   * @param value - The value to check
   *
   * @returns `true` if the value is a vector-like value; `false` otherwise
   */
  public static isVectorLike(value: unknown): value is DataAPIVectorLike {
    return !!value && typeof value === 'object' && ((Array.isArray(value) && typeof value[0] === 'number') || value instanceof Float32Array || ('$binary' in value && typeof value.$binary === 'string') || value instanceof DataAPIVector);
  }

  /**
   * Should not be called by user directly
   *
   * @internal
   */
  public serialize(): number[] | { $binary: string } {
    if ('$binary' in this._vector) {
      return this._vector;
    }
    return serializeFromArray(this._vector);
  }
}

const serializeFromArray = forJSEnv<[number[] | Float32Array], number[] | { $binary: string }>({
  server: (vector) => {
    const buffer = Buffer.allocUnsafe(vector.length * 4);

    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatBE(vector[i], i * 4);
    }

    return { $binary: buffer.toString('base64') };
  },
  browser: (vector) => {
    const buffer = new Uint8Array(vector.length * 4);
    const view = new DataView(buffer.buffer);

    for (let i = 0; i < vector.length; i++) {
      view.setFloat32(i * 4, vector[i], false);
    }

    let binary = '';
    for (const byte of buffer) {
      binary += String.fromCharCode(byte);
    }

    return { $binary: window.btoa(binary) };
  },
  unknown: (vector) => {
    if (vector instanceof Float32Array) {
      return Array.from(vector);
    }
    return vector;
  },
});

const deserializeToNumberArray = forJSEnv<[string], number[] | undefined>({
  server: (serialized) => {
    const buffer = Buffer.from(serialized, 'base64');
    const vector = Array.from<number>({ length: buffer.length / 4 });

    for (let i = 0; i < vector.length; i++) {
      vector[i] = buffer.readFloatBE(i * 4);
    }

    return vector;
  },
  browser: (serialized) => {
    const deserialized = deserializeToF32Array(serialized);
    return Array.from(deserialized!);
  },
  unknown: () => {
    return undefined;
  },
});

const deserializeToF32Array = forJSEnv<[string], Float32Array | undefined>({
  server: (serialized) => {
    const buffer = Buffer.from(serialized, 'base64');
    const vector = new Float32Array(buffer.length / 4);

    for (let i = 0; i < vector.length; i++) {
      vector[i] = buffer.readFloatBE(i * 4);
    }

    return vector;
  },
  browser: (serialized) => {
    const binary = window.atob(serialized);
    const buffer = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }

    const vector = new Float32Array(buffer.buffer);
    const view = new DataView(buffer.buffer);

    for (let i = 0; i < vector.length; i++) {
      vector[i] = view.getFloat32(i * 4, false);
    }

    return vector;
  },
  unknown: () => {
    return undefined;
  },
});
