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
import { DataAPIBlob, blob, UUID, uuid } from '@/src/documents';
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
  });

  describe('coercion', () => {

  });
});
