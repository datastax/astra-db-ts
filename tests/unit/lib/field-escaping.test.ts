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
import { describe, it } from '@/tests/testlib/index.js';
import { escapeFieldNames, unescapeFieldPath } from '@/src/lib/index.js';

describe('unit.lib.field-escaping', () => {
  describe('escapeFieldNames', () => {
    it('works with varargs', () => {
      assert.deepStrictEqual(escapeFieldNames('a&', 'b..', 0, 'c&d'), 'a&&.b&.&..0.c&&d');
    });

    it('works with iterable', () => {
      assert.deepStrictEqual(escapeFieldNames(['a&', 'b..', 0, 'c&d']), 'a&&.b&.&..0.c&&d');
      assert.deepStrictEqual(escapeFieldNames(new Set(['a&', 'b..', 0, 'c&d'])), 'a&&.b&.&..0.c&&d');
    });

    it('works with template strings overload', () => {
      assert.deepStrictEqual(escapeFieldNames`a&.${'b..'}.${0}.&c&d`,'a&.b&.&..0.&c&d');
      assert.deepStrictEqual(escapeFieldNames`a&&.${'b..'}.${0}.${'c&d'}`, 'a&&.b&.&..0.c&&d');
      assert.deepStrictEqual(escapeFieldNames`${'a&'}.${'b..'}.${0}.${'c&d'}`, 'a&&.b&.&..0.c&&d');
    });
  });

  describe('unescapeFieldPath', () => {
    it('unescapes valid paths', () => {
      const test = (input: string, expected: string[]) => {
        assert.deepStrictEqual(unescapeFieldPath(input), expected);
      };

      test('', []);
      test('a.a', ['a', 'a']);
      test('a&.', ['a.']);
      test('a&.a', ['a.a']);
      test('a&.a&&&.a', ['a.a&.a']);
      test('a&&&.b&.c&&&&d', ['a&.b.c&&d']);
      test('p.0', ['p', '0']);
      test('&&.&.', ['&', '.']);
      test('&&', ['&']);
      test('&.', ['.']);
      test('tom&&jerry&..&.', ['tom&jerry.', '.']);
    });

    it('errors on invalid paths', () => {
      const test = (input: string, message: (s: string) => string) => {
        assert.throws(() => unescapeFieldPath(input), { message: message(input) });
      };

      test('.', (p) => `Invalid field path '${p}'; '.' may not appear at the end of the path`);
      test('a.', (p) => `Invalid field path '${p}'; '.' may not appear at the end of the path`);
      test('a.b.', (p) => `Invalid field path '${p}'; '.' may not appear at the end of the path`);
      test('a..', (p) => `Invalid field path '${p}'; '.' may not appear at the end of the path`);

      test('a..b', (p) => `Invalid field path '${p}'; empty segment found at position 2`);

      test('&', (p) => `Invalid escape sequence in field path '${p}'; '&' may not appear at the end of the path`);
      test('a&', (p) => `Invalid escape sequence in field path '${p}'; '&' may not appear at the end of the path`);
      test('a&&&', (p) => `Invalid escape sequence in field path '${p}'; '&' may not appear at the end of the path`);

      test('a&b.', (p) => `Invalid escape sequence in field path '${p}' at position 1; '&' may not appear alone (must be used as either '&&' or '&.')`);
      test('&&&a', (p) => `Invalid escape sequence in field path '${p}' at position 2; '&' may not appear alone (must be used as either '&&' or '&.')`);
      test('&.&a', (p) => `Invalid escape sequence in field path '${p}' at position 2; '&' may not appear alone (must be used as either '&&' or '&.')`);
    });
  });
});
