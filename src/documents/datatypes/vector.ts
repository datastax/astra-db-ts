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

import { $SerializeRelaxed, $SerializeStrict } from '@/src/lib';

export type DataAPIVectorLike = number[] | string | Float32Array;

export class DataAPIVector {
  readonly #vector: DataAPIVectorLike;

  constructor(vector: DataAPIVectorLike) {
    this.#vector = vector;

    // Object.defineProperty(this, $SerializeStrict, {
    //   value: this.toJSON,
    // });
    //
    // Object.defineProperty(this, $SerializeRelaxed, {
    //   value: this.toString,
    // });
  }

  public getRaw(): DataAPIVectorLike {
    return this.#vector;
  }

  // public getAsArray(): number[] {
  //
  // }
  //
  // public getAsFloat32Array(): Float32Array {
  //
  // }
  //
  // public getAsBase64(): string {
  //
  // }
  //
  // static #serialize(vector: DataAPIVectorLike): string | number[] {
  //   if (typeof vector === 'string') {
  //     return vector;
  //   }
  //
  //   if (Array.isArray(vector)) {
  //     vector = new Float32Array(vector);
  //   }
  //
  //   if (typeof Buffer !== 'undefined') {
  //     return Buffer.from(vector.buffer).toString('base64');
  //   }
  //
  //   if (typeof window !== 'undefined' && window.btoa) {
  //     return window.btoa(String.fromCharCode(...new Uint8Array(vector.buffer)));
  //   }
  // }
}
