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
  extractDbComponentsFromAstraUrl,
  mkInvArgsError,
  mkWrongTypeError,
} from '@/src/documents/utils.js';
import { describe, it } from '@/tests/testlib/index.js';
import { vector } from '@/src/documents/index.js';
import * as bn from 'bignumber.js';
import fc, { constantFrom } from 'fast-check';

describe('unit.documents.utils', () => {
  describe('extractDbComponentsFromAstraUrl', () => {
    it('should extract the db id and region from valid astra endpoints', () => {
      const astraEnvArb = constantFrom('astra', 'astra-dev', 'astra-test');

      fc.assert(
        fc.property(fc.uuid(), fc.stringMatching(/^[a-z_-]+$/), astraEnvArb, (uuid, region, astraEnv) => {
          const endpoint = `https://${uuid}-${region}.apps.${astraEnv}.datastax.com`;
          assert.deepStrictEqual(extractDbComponentsFromAstraUrl(endpoint), [uuid, region]);
        }),
      );
    });

    it('should return empty array for invalid astra endpoints', () => {
      fc.assert(
        fc.property(fc.webUrl(), (webURL) => {
          assert.deepStrictEqual(extractDbComponentsFromAstraUrl(webURL), []);
        }),
      );

      fc.assert(
        fc.property(fc.string(), (webURL) => {
          assert.deepStrictEqual(extractDbComponentsFromAstraUrl(webURL), []);
        }),
      );
    });
  });

  describe('betterTypeOf', () => {
    it('should work', () => {
      const eq = (expected: string, t: unknown) => assert.deepStrictEqual(betterTypeOf(t), expected);
      eq(              'null', null                );
      eq(            'Object', {}                  );
      eq( 'Object[NullProto]', Object.create(null) );
      eq(      'Array[Empty]', []                  );
      eq(             'Array', [1, 2, 3]           );
      eq(          'function', () => {}            );
      eq(     'DataAPIVector', vector([1, 2, 3])   );
      eq(         'BigNumber', bn.BigNumber(123)   );
      eq(          'function', bn.BigNumber        );
      eq(            'string', 'hello world'       );
      eq(            'number', 123                 );
      eq(            'bigint', 123n                );
    });
  });

  describe('mkInvArgsErr', () => {
    it('should work', () => {
      const err = mkInvArgsError('fn', [['a', 'number'], ['b', 'string']], bn.BigNumber(3), 'hello');
      assert(err as unknown instanceof TypeError);
      assert.strictEqual(err.message, 'Invalid argument(s) for `fn(a, b)`; expected (number, string), got (BigNumber, string)');
    });
  });

  describe('mkWrongTypeError', () => {
    it('should work', () => {
      const err = mkWrongTypeError('name', 'string', bn.BigNumber(123));
      assert(err as unknown instanceof TypeError);
      assert.strictEqual(err.message, `Expected 'name' to be of type 'string', but got 'BigNumber' (123)`);
    });
  });
});
