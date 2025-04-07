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
import type { DataAPIBlobLike } from '@/src/documents/index.js';
import { blob, DataAPIBlob } from '@/src/documents/index.js';
import { describe, it } from '@/tests/testlib/index.js';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';
import { AlwaysAvailableBuffer } from '@/tests/testlib/utils.js';

describe('unit.documents.datatypes.blob', () => {
  const blobLikeArb = fc.oneof(
    arbs.validBase46().map((base64) => Buffer.from(base64, 'base64')),
    arbs.validBase46().map((base64) => new Uint8Array(Buffer.from(base64, 'base64')).buffer),
    arbs.validBase46().map((base64) => ({ $binary: base64 })),
  );

  const allBlobLikeArb = arbs.validBase46().map((base64) => {
    const buffer = AlwaysAvailableBuffer.from(base64, 'base64');

    return <const>[
      buffer,
      new Uint8Array(buffer).buffer,
      { $binary: base64 },
    ];
  });

  describe('construction', () => {
    it('should create blobs of each type', () => {
      fc.assert(
        fc.property(blobLikeArb, (blobLike) => {
          assert.deepStrictEqual(new DataAPIBlob(blobLike).raw(), blobLike);
          assert.deepStrictEqual(blob(blobLike).raw(), blobLike);
          assert.deepStrictEqual(blob(blob(blobLike)).raw(), blobLike);
        }),
      );
    });

    it('should error on invalid values', () => {
      fc.assert(
        fc.property(fc.anything(), (invalid) => {
          fc.pre(!DataAPIBlob.isBlobLike(invalid));
          assert.throws(() => new DataAPIBlob(invalid as DataAPIBlobLike));
        }),
      );
    });

    it('should allow invalid values on validation: false', () => {
      fc.assert(
        fc.property(fc.anything(), (invalid) => {
          const blb = new DataAPIBlob(invalid as DataAPIBlobLike, false);
          assert.deepStrictEqual(blb.raw(), invalid);
        }),
      );
    });
  });

  it('should get the byte length of all types', () => {
    fc.assert(
      fc.property(allBlobLikeArb, (bls) => {
        const expectedLength = bls[0].length;

        for (const blb of bls) {
          assert.strictEqual(blob(blb).byteLength, expectedLength);
          assert.strictEqual(blob(blob(blb)).byteLength, expectedLength);
        }
      }),
    );
  });

  it('should convert between all types on the server', () => {
    fc.assert(
      fc.property(allBlobLikeArb, ([buff, arrBuff, binary]) => {
        const blobs = [blob(buff), blob(arrBuff), blob(binary), blob(blob(buff))];

        for (const blb of blobs) {
          assert.strictEqual(blb.asBase64(), binary.$binary);
          assert.deepStrictEqual(blb.asBuffer(), buff);
          assert.deepStrictEqual(blb.asArrayBuffer(), arrBuff);
        }
      }),
    );
  });

  // Technically the browser doesn't have the Buffer, but the "absent Buffer" case is tested in the next test anyway
  it('should convert between compatible types in the browser', { pretendEnv: 'browser' }, () => {
    fc.assert(
      fc.property(allBlobLikeArb, ([buff, arrBuff, binary]) => {
        const blobs = [blob(buff), blob(arrBuff), blob(binary), blob(blob(buff))];

        for (const blb of blobs) {
          assert.strictEqual(blb.asBase64(), binary.$binary);
          assert.deepStrictEqual(blb.asBuffer(), buff);
          assert.deepStrictEqual(blb.asArrayBuffer(), arrBuff);
        }
      }),
    );
  });

  // This is mainly just testing to see what happens if both Buffer and window are undefined
  it('should throw various conversion errors in unknown environments', { pretendEnv: 'unknown' }, () => {
    fc.assert(
      fc.property(allBlobLikeArb, ([buff, arrBuff, binary]) => {
        assert.throws(() => blob(buff).asBase64());
        assert.throws(() => blob(buff).asBuffer());
        assert.throws(() => blob(buff).asArrayBuffer());

        assert.throws(() => blob(arrBuff).asBase64());
        assert.throws(() => blob(arrBuff).asBuffer());
        assert.deepStrictEqual(blob(arrBuff).asArrayBuffer(), arrBuff);

        assert.deepStrictEqual(blob(binary).asBase64(), binary.$binary);
        assert.throws(() => blob(binary).asBuffer());
        assert.throws(() => blob(binary).asArrayBuffer());
      }),
    );
  });

  it('should throw on Buffer not available', { pretendEnv: 'browser' }, () => {
    const blb = new DataAPIBlob(Buffer.from([0x0, 0x1, 0x2]));

    const origBuffer = globalThis.Buffer;
    delete (<any>globalThis).Buffer;

    try {
      assert.throws(() => blb.asBuffer());
    } finally {
      globalThis.Buffer = origBuffer;
    }
  });

  it('should have a working toString()', () => {
    fc.assert(
      fc.property(allBlobLikeArb, ([buff, arrBuff, binary]) => {
        assert.strictEqual(blob(buff).toString(), `DataAPIBlob(typeof raw=Buffer, byteLength=${buff.length})`);
        assert.strictEqual(blob(arrBuff).toString(), `DataAPIBlob(typeof raw=ArrayBuffer, byteLength=${buff.length})`);
        assert.strictEqual(blob(binary).toString(), `DataAPIBlob(typeof raw=base64, byteLength=${buff.length})`);
        assert.strictEqual(blob(blob(binary)).toString(), `DataAPIBlob(typeof raw=base64, byteLength=${buff.length})`);
      }),
    );
  });
});
