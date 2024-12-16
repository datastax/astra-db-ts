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

describe('unit.documents.datatypes.blob', () => {
  describe('construction', () => {
    it('should properly construct a DataAPIBlob', () => {
      const buff = Buffer.from([0x0, 0x1, 0x2]).buffer;
      const blb = new DataAPIBlob(buff);
      assert.strictEqual(blb.raw(), buff);
    });

    it('should properly construct a DataAPIBlob using the shorthand', () => {
      const buff = Buffer.from([0x0, 0x1, 0x2]).buffer;
      const blb = blob(buff);
      assert.strictEqual(blb.raw(), buff);
    });

    it('should properly construct a DataAPIBlob using ArrayBuffer', () => {
      const buff = Buffer.from([0x0, 0x1, 0x2]).buffer;
      const blb = new DataAPIBlob(buff);
      assert.strictEqual(blb.raw(), buff);
    });

    it('should properly construct a DataAPIBlob using $binary', () => {
      const blb = new DataAPIBlob({ $binary: 'AAEC' });
      assert.strictEqual(blb.asBase64(), 'AAEC');
    });

    it('should properly construct a DataAPIBlob using another DataAPIBlob', () => {
      const blb = new DataAPIBlob({ $binary: 'AAEC' });
      const blb2 = new DataAPIBlob(blb);
      assert.strictEqual(blb2.asBase64(), 'AAEC');
    });

    it('should error on invalid type', () => {
      assert.throws(() => new DataAPIBlob({} as any));
    });

    it('should allow on invalid type on validation: false', () => {
      const blb = new DataAPIBlob({} as any, false);
      assert.deepStrictEqual(blb.raw(), {});
    });
  });

  describe('byteLength', () => {
    it('should return the byte length of the buffer from Buffer', () => {
      const buff = Buffer.from([0x0, 0x1, 0x2]);
      const blb = new DataAPIBlob(buff);
      assert.strictEqual(blb.byteLength, 3);
    });

    it('should return the byte length of the buffer from ArrayBuffer', () => {
      const buff = new ArrayBuffer(3);
      const blb = new DataAPIBlob(buff);
      assert.strictEqual(blb.byteLength, 3);
    });

    it('should return the byte length of the buffer from $binary', () => {
      const blb = new DataAPIBlob({ $binary: 'AAEC' });
      assert.strictEqual(blb.byteLength, 3);
    });
  });

  describe('coercion', () => {
    it('should return Buffer as ArrayBuffer', () => {
      const buff = Buffer.from([0x0, 0x1, 0x2]);
      const blb = new DataAPIBlob(buff);
      assert.ok(blb.asArrayBuffer() instanceof ArrayBuffer);
      assert.deepStrictEqual(new Uint8Array(blb.asArrayBuffer()), new Uint8Array([0x0, 0x1, 0x2]));
    });

    it('should return $binary as ArrayBuffer', () => {
      const blb = new DataAPIBlob({ $binary: 'AAEC' });
      assert.ok(blb.asArrayBuffer() instanceof ArrayBuffer);
      assert.deepStrictEqual(new Uint8Array(blb.asArrayBuffer()), new Uint8Array([0x0, 0x1, 0x2]));
    });

    it('should return ArrayBuffer as Buffer', () => {
      const buff = new Uint8Array([0x0, 0x1, 0x2]).buffer;
      const blb = new DataAPIBlob(buff);
      assert.ok(blb.asBuffer() instanceof Buffer);
      assert.deepStrictEqual(blb.asBuffer(), Buffer.from([0x0, 0x1, 0x2]));
    });

    it('should return $binary as Buffer', () => {
      const blb = new DataAPIBlob({ $binary: 'AAEC' });
      assert.ok(blb.asBuffer() instanceof Buffer);
      assert.deepStrictEqual(blb.asBuffer(), Buffer.from([0x0, 0x1, 0x2]));
    });

    it('should throw on Buffer not available', () => {
      const buff = Buffer.from([0x0, 0x1, 0x2]);
      const blb = new DataAPIBlob(buff);
      const origBuffer = globalThis.Buffer;
      delete (<any>globalThis).Buffer;
      assert.throws(() => blb.asBuffer());
      globalThis.Buffer = origBuffer;
    });

    it('should return Buffer as $binary', () => {
      const buff = Buffer.from([0x0, 0x1, 0x2]);
      const blb = new DataAPIBlob(buff);
      assert.strictEqual(blb.asBase64(), 'AAEC');
    });

    it('should return ArrayBuffer as $binary', () => {
      const buff = new Uint8Array([0x0, 0x1, 0x2]).buffer;
      const blb = new DataAPIBlob(buff);
      assert.strictEqual(blb.asBase64(), 'AAEC');
    });
  });
});
