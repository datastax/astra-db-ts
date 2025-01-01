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
    it('should create vectors of each type', () => {
      const vectorLikes = [ARR, F32ARR, BINARY];

      for (const vectorLike of vectorLikes) {
        const full = new DataAPIVector(vectorLike);
        const shorthand = vector(vectorLike);
        assert.deepStrictEqual(full.raw(), vectorLike);
        assert.deepStrictEqual(shorthand.raw(), vectorLike);
        assert.deepStrictEqual(full.raw(), shorthand.raw());
      }
    });

    it('should create a vector from another vector', () => {
      const vectorLikes = [ARR, F32ARR, BINARY];

      for (const vectorLike of vectorLikes) {
        const original = new DataAPIVector(vectorLike);
        const copy = vector(original);
        assert.deepStrictEqual(original.raw(), copy.raw());
      }
    });

    it('should error on invalid type', () => {
      assert.throws(() => new DataAPIVector({} as any));
    });

    it('should allow on invalid type on validation: false', () => {
      const vec = new DataAPIVector({} as any, false);
      assert.deepStrictEqual(vec.raw(), {});
    });
  });

  it('should get length of all types', () => {
    const vectors = [vector(ARR), vector(F32ARR), vector(BINARY), vector(vector(ARR))];

    for (const vec of vectors) {
      assert.strictEqual(vec.length, 3);
    }
  });

  it('should convert between all types', () => {
    const vectors = [vector(ARR), vector(F32ARR), vector(BINARY), vector(vector(ARR))];

    for (const vec of vectors) {
      assert.strictEqual(vec.asBase64(), BINARY.$binary);
      assert.deepStrictEqual(vec.asArray(), ARR);
      assert.deepStrictEqual(vec.asFloat32Array(), F32ARR);
    }
  });
});
