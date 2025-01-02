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
import { blob, DataAPIBlob } from '@/src/documents';
import { describe, it } from '@/tests/testlib';

const BUFF = Buffer.from([0x0, 0x1, 0x2]);
const ARR_BUFF = new Uint8Array(BUFF).buffer;
const BINARY = { $binary: 'AAEC' };

describe('unit.documents.datatypes.blob', () => {
  describe('construction', () => {
    it('should create blobs of each type', () => {
      const blobLikes = [BUFF, ARR_BUFF, BINARY];

      for (const blobLike of blobLikes) {
        const full = new DataAPIBlob(blobLike);
        const shorthand = blob(blobLike);
        assert.deepStrictEqual(full.raw(), blobLike);
        assert.deepStrictEqual(shorthand.raw(), blobLike);
        assert.deepStrictEqual(full.raw(), shorthand.raw());
      }
    });

    it('should create a blob from another blob', () => {
      const blobLikes = [BUFF, ARR_BUFF, BINARY];

      for (const blobLike of blobLikes) {
        const original = new DataAPIBlob(blobLike);
        const copy = blob(original);
        assert.deepStrictEqual(original.raw(), copy.raw());
      }
    });

    it('should error on invalid type', () => {
      assert.throws(() => new DataAPIBlob({} as any));
    });

    it('should allow on invalid type on validation: false', () => {
      const blb = new DataAPIBlob({} as any, false);
      assert.deepStrictEqual(blb.raw(), {});
    });
  });

  it('should get the byte length of all types', () => {
    const blobs = [blob(BUFF), blob(ARR_BUFF), blob(BINARY), blob(blob(BUFF))];

    for (const blb of blobs) {
      assert.strictEqual(blb.byteLength, 3);
    }
  });

  it('should convert between all types on the server', () => {
    const blobs = [blob(BUFF), blob(ARR_BUFF), blob(BINARY), blob(blob(BUFF))];

    for (const blb of blobs) {
      assert.strictEqual(blb.asBase64(), BINARY.$binary);
      assert.deepStrictEqual(blb.asBuffer(), BUFF);
      assert.deepStrictEqual(blb.asArrayBuffer(), ARR_BUFF);
    }
  });

  // Technically the browser doesn't have the Buffer, but the "absent Buffer" case is tested in the next test anyways
  it('should convert between compatible types in the browser', { pretendEnv: 'browser' }, () => {
    const blobs = [blob(BUFF), blob(ARR_BUFF), blob(BINARY), blob(blob(ARR_BUFF))];

    for (const blb of blobs) {
      assert.strictEqual(blb.asBase64(), BINARY.$binary);
      assert.deepStrictEqual(blb.asBuffer(), BUFF);
      assert.deepStrictEqual(blb.asArrayBuffer(), ARR_BUFF);
    }
  });

  // This is mainly just testing to see what happens if both Buffer and window are undefined
  it('should throw various conversion errors in unknown environments', { pretendEnv: 'unknown' }, () => {
    assert.throws(() => blob(BUFF).asBase64());
    assert.throws(() => blob(BUFF).asBuffer());
    assert.throws(() => blob(BUFF).asArrayBuffer());

    assert.throws(() => blob(ARR_BUFF).asBase64());
    assert.throws(() => blob(ARR_BUFF).asBuffer());
    assert.ok(blob(ARR_BUFF).asArrayBuffer());

    assert.ok(blob(BINARY).asBase64());
    assert.throws(() => blob(BINARY).asBuffer());
    assert.throws(() => blob(BINARY).asArrayBuffer());
  });

  it('should throw on Buffer not available', () => {
    const blb = new DataAPIBlob(BUFF);
    const origBuffer = globalThis.Buffer;
    delete (<any>globalThis).Buffer;
    assert.throws(() => blb.asBuffer());
    globalThis.Buffer = origBuffer;
  });
});
