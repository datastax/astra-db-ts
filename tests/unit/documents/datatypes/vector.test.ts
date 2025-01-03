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
// noinspection DuplicatedCode

import assert from 'assert';
import { DataAPIVector, vector } from '@/src/documents';
import { describe, it } from '@/tests/testlib';

const ARR = [.5, .5, .5];
const F32ARR = new Float32Array(ARR);
const BINARY = { $binary: 'PwAAAD8AAAA/AAAA' };

describe('unit.documents.datatypes.vector', () => {
  describe('construction', () => {
    it('should properly construct a DataAPIVector', () => {
      const vec = new DataAPIVector(ARR);
      assert.strictEqual(vec.raw(), ARR);
    });

    it('should properly construct a DataAPIVector using the shorthand', () => {
      const vec = vector(ARR);
      assert.strictEqual(vec.raw(), ARR);
    });

    it('should properly construct a DataAPIVector using a Float32Array', () => {
      const vec = new DataAPIVector(F32ARR);
      assert.strictEqual(vec.raw(), F32ARR);
    });

    it('should properly construct a DataAPIVector using $binary', () => {
      const vec = new DataAPIVector(BINARY);
      assert.strictEqual(vec.raw(), BINARY);
    });

    it('should properly construct a DataAPIVector using another DataAPIVector', () => {
      const vec = new DataAPIVector(BINARY);
      const vec2 = new DataAPIVector(vec);
      assert.strictEqual(vec2.raw(), BINARY);
    });

    it('should error on invalid type', () => {
      assert.throws(() => new DataAPIVector({} as any));
    });

    it('should allow on invalid type on validation: false', () => {
      const vec = new DataAPIVector({} as any, false);
      assert.deepStrictEqual(vec.raw(), {});
    });
  });

  describe('length', () => {
    it('should return the length of the vector from number[]', () => {
      const vec = new DataAPIVector(ARR);
      assert.strictEqual(vec.length, 3);
    });

    it('should return the length of the vector from Float32Array', () => {
      const vec = new DataAPIVector(F32ARR);
      assert.strictEqual(vec.length, 3);
    });

    it('should return the length of the vector from $binary', () => {
      const vec = new DataAPIVector(BINARY);
      assert.strictEqual(vec.length, 3);
    });
  });

  describe('coercion', () => {
    it('should return number[] as $binary', () => {
      const vec = new DataAPIVector(ARR);
      assert.deepStrictEqual(vec.asBase64(), BINARY.$binary);
    });

    it('should return Float32Array as $binary', () => {
      const vec = new DataAPIVector(F32ARR);
      assert.deepStrictEqual(vec.asBase64(), BINARY.$binary);
    });

    it('should return Float32Array as number[]', () => {
      const vec = new DataAPIVector(F32ARR);
      assert.deepStrictEqual(vec.asArray(), ARR);
    });

    it('should return $binary as number[]', () => {
      const vec = new DataAPIVector(BINARY);
      assert.deepStrictEqual(vec.asArray(), ARR);
    });

    it('should return $binary as Float32Array', () => {
      const vec = new DataAPIVector(BINARY);
      assert.deepStrictEqual(vec.asFloat32Array(), F32ARR);
    });

    it('should return number[] as Float32Array', () => {
      const vec = new DataAPIVector(ARR);
      assert.deepStrictEqual(vec.asFloat32Array(), F32ARR);
    });
  });
});
