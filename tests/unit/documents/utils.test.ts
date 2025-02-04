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

import assert from 'assert';
import {
  betterTypeOf,
  extractDbIdFromUrl,
  extractRegionFromUrl,
  mkInvArgsErr,
  normalizedSort,
} from '@/src/documents/utils.js';
import { describe, it } from '@/tests/testlib/index.js';
import { vector } from '@/src/documents/index.js';
import * as bn from 'bignumber.js';

describe('unit.documents.utils', () => {
  describe('extractDbIdFromUri', () => {
    it('should extract the db id from the uri', () => {
      const endpoint1 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com';
      const id1 = extractDbIdFromUrl(endpoint1);
      assert.strictEqual(id1, 'a5cf1913-b80b-4f44-ab9f-a8b1c98469d0');

      const endpoint2 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra-dev.datastax.com';
      const id2 = extractDbIdFromUrl(endpoint2);
      assert.strictEqual(id2, 'a5cf1913-b80b-4f44-ab9f-a8b1c98469d0');
    });

    it('returned undefined on invalid url', () => {
      const endpoint1 = 'https://localhost:3000';
      const id1 = extractDbIdFromUrl(endpoint1);
      assert.strictEqual(id1, undefined);

      const endpoint2 = 'https://z5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com';
      const id2 = extractDbIdFromUrl(endpoint2);
      assert.strictEqual(id2, undefined);
    });
  });

  describe('extractDbRegionFromUri', () => {
    it('should extract the db id from the uri', () => {
      const endpoint1 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com';
      const id1 = extractRegionFromUrl(endpoint1);
      assert.strictEqual(id1, 'ap-south-1');

      const endpoint2 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra-dev.datastax.com';
      const id2 = extractRegionFromUrl(endpoint2);
      assert.strictEqual(id2, 'ap-south-1');
    });

    it('returned undefined on invalid url', () => {
      const endpoint1 = 'https://localhost:3000';
      const id1 = extractRegionFromUrl(endpoint1);
      assert.strictEqual(id1, undefined);

      const endpoint2 = 'https://a5cf1913-b80b-4f44-ab9f-ap-south-1.apps.astra.datastax.com';
      const id2 = extractRegionFromUrl(endpoint2);
      assert.strictEqual(id2, 'south-1');
    });
  });

  describe('normalizedSort', () => {
    it('should work', () => {
      assert.deepStrictEqual(normalizedSort({}), {});

      assert.deepStrictEqual(normalizedSort({
        field1: 1,
        field2: -1,
        field3: [1, 2, 3],
        field4: vector([1, 2, 3]),
        field5: { $binary: 'aGVsbG8=' },
        field6: 'hello world',
      }), {
        field1: 1,
        field2: -1,
        field3: vector([1, 2, 3]).serialize(),
        field4: vector([1, 2, 3]).serialize(),
        field5: { $binary: 'aGVsbG8=' },
        field6: 'hello world',
      });
    });
  });

  describe('betterTypeOf', () => {
    it('should work', () => {
      const eq = (expected: string, t: unknown) => assert.deepStrictEqual(betterTypeOf(t), expected);
      eq(          'null', null              );
      eq(        'Object', {}                );
      eq(         'Array', []                );
      eq(         'Array', [1, 2, 3]         );
      eq(      'function', () => {}          );
      eq( 'DataAPIVector', vector([1, 2, 3]) );
      eq(     'BigNumber', bn.BigNumber(123) );
      eq(      'function', bn.BigNumber      );
      eq(        'string', 'hello world'     );
      eq(        'number', 123               );
      eq(        'bigint', 123n              );
    });
  });

  describe('mkInvArgsErr', () => {
    it('should work', () => {
      const err = mkInvArgsErr('fn', [['a', 'number'], ['b', 'string']], bn.BigNumber(3), 'hello');
      assert(err as unknown instanceof TypeError);
      assert.strictEqual(err.message, 'Invalid argument(s) for `fn(a, b)`; expected (number, string), got (BigNumber, string)');
    });
  });
});
