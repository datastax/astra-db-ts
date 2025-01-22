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
import { $CustomInspect } from '@/src/lib/constants';

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

  it('should convert between all types on the server', () => {
    const vectors = [vector(ARR), vector(F32ARR), vector(BINARY), vector(vector(ARR))];

    for (const vec of vectors) {
      assert.strictEqual(vec.asBase64(), BINARY.$binary);
      assert.deepStrictEqual(vec.asArray(), ARR);
      assert.deepStrictEqual(vec.asFloat32Array(), F32ARR);
    }
  });

  it('should convert between all types in the browser', { pretendEnv: 'browser' }, () => {
    const vectors = [vector(ARR), vector(F32ARR), vector(BINARY), vector(vector(ARR))];

    for (const vec of vectors) {
      assert.strictEqual(vec.asBase64(), BINARY.$binary);
      assert.deepStrictEqual(vec.asArray(), ARR);
      assert.deepStrictEqual(vec.asFloat32Array(), F32ARR);
    }
  });

  it('should throw various conversion errors in unknown environments', { pretendEnv: 'unknown' }, () => {
    assert.throws(() => vector(ARR).asBase64());
    assert.ok(vector(ARR).asArray());
    assert.ok(vector(ARR).asFloat32Array());

    assert.throws(() => vector(F32ARR).asBase64());
    assert.ok(vector(F32ARR).asArray());
    assert.ok(vector(F32ARR).asFloat32Array());

    assert.ok(vector(BINARY).asBase64());
    assert.throws(() => vector(BINARY).asArray());
    assert.throws(() => vector(BINARY).asFloat32Array());

    assert.throws(() => vector(vector(ARR)).asBase64());
    assert.ok(vector(vector(ARR)).asArray());
    assert.ok(vector(vector(ARR)).asFloat32Array());
  });

  it('has a working toString()', () => {
    assert.strictEqual(vector(ARR).toString(), 'DataAPIVector<3>(typeof raw=number[], preview=[0.5, 0.5, ...])');
    assert.strictEqual(vector(F32ARR).toString(), 'DataAPIVector<3>(typeof raw=Float32Array, preview=[0.5, 0.5, ...])');
    assert.strictEqual(vector(BINARY).toString(), 'DataAPIVector<3>(typeof raw=base64, preview="PwAAAD8AAAA/...")');

    assert.strictEqual(vector([.5]).toString(), 'DataAPIVector<1>(typeof raw=number[], preview=[0.5])');
    assert.strictEqual(vector(new Float32Array([.5])).toString(), 'DataAPIVector<1>(typeof raw=Float32Array, preview=[0.5])');
    assert.strictEqual(vector({ $binary: 'PczMzQ==' }).toString(), 'DataAPIVector<1>(typeof raw=base64, preview="PczMzQ==")');
  });

  it('has a working inspect', () => {
    assert.strictEqual((vector(ARR) as any)[$CustomInspect](), 'DataAPIVector<3>(typeof raw=number[], preview=[0.5, 0.5, ...])');
    assert.strictEqual((vector(F32ARR) as any)[$CustomInspect](), 'DataAPIVector<3>(typeof raw=Float32Array, preview=[0.5, 0.5, ...])');
    assert.strictEqual((vector(BINARY) as any)[$CustomInspect](), 'DataAPIVector<3>(typeof raw=base64, preview="PwAAAD8AAAA/...")');
  });
});
