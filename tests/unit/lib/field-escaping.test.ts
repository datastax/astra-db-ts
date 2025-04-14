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
import fc from 'fast-check';

describe('unit.lib.field-escaping', () => {
  const PathSegmentsArb = fc.array(
    fc.oneof(
      fc.string().filter(s => !!s),
      fc.nat(),
    ),
  );

  describe('escapeFieldNames', () => {
    it('returns an empty string for empty arrays', () => {
      assert.strictEqual(escapeFieldNames([]), '');
      assert.strictEqual(escapeFieldNames(...[]), '');
      assert.strictEqual(escapeFieldNames``, '');
    });

    it('escapes path segments', () => {
      assert.deepStrictEqual(escapeFieldNames('a&', 'b..', 0, 'c&d'), 'a&&.b&.&..0.c&&d');
      assert.deepStrictEqual(escapeFieldNames(['a&', 'b..', 0, 'c&d']), 'a&&.b&.&..0.c&&d');
      assert.deepStrictEqual(escapeFieldNames`a&.${'b..'}.${0}.&c&d`,'a&.b&.&..0.&c&d');
    });

    it('should never output a standalone . or &', () => {
      const StandaloneDotRegex = /(?<!&)\.\./;
      const StandaloneAmpersandRegex =/(^|[^&])&($|[^&.])/;

      fc.assert(
        fc.property(PathSegmentsArb, (arr) => {
          const escaped = escapeFieldNames(...arr);
          assert.ok(!StandaloneDotRegex.exec(escaped));
          assert.ok(!StandaloneAmpersandRegex.exec(escaped));
        }),
      );
    });

    it('returns the same value for varargs, arrays, template strings, and other arbitrary iterables', () => {
      fc.assert(
        fc.property(PathSegmentsArb, (arr) => {
          const iterator = (function* () {
            yield* arr;
          })();

          const control = escapeFieldNames(arr);

          assert.deepStrictEqual(control, escapeFieldNames(...arr));
          assert.deepStrictEqual(control, escapeFieldNames(iterator));

          const templateStrArr = ['', ...Array.from({ length: arr.length - 1 }, (_) => `.`) ,''];
          (templateStrArr as any).raw = null;
          assert.deepStrictEqual(control, escapeFieldNames(templateStrArr as unknown as TemplateStringsArray, ...arr));
        }),
      );
    });

    it('doesnt error on invalid template strings outputs', () => {
      assert.deepStrictEqual(escapeFieldNames`..1.${'.1.'}`, `..1.&.1&.`);
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

    it('should error if path starts with a .', () => {
      const arb = fc.string().map(s => `.${s}`);

      const prop = fc.property(arb, (invalidPath) => {
        assert.throws(() => unescapeFieldPath(invalidPath), { message: `Invalid field path '${invalidPath}'; '.' may not appear at the beginning of the path` });
      });
      fc.assert(prop);
    });

    const StringPathSegArb = fc.string().filter(s => !s.includes('.') && !s.includes('&'));
    const NEStringPathSegArb = StringPathSegArb.filter(s => !!s);

    it('should error if path ends with a .', () => {
      assert.doesNotThrow(() => unescapeFieldPath('&.'));

      const arb = NEStringPathSegArb.map(s => `${s}.`);

      const prop = fc.property(arb, (invalidPath) => {
        assert.throws(() => unescapeFieldPath(invalidPath), { message: `Invalid field path '${invalidPath}'; '.' may not appear at the end of the path` });
      });
      fc.assert(prop);
    });

    it('should error if path ends with a &', () => {
      assert.doesNotThrow(() => unescapeFieldPath('&&'));

      const arb = StringPathSegArb.map(s => `${s}&`);

      const prop = fc.property(arb, (invalidPath) => {
        assert.throws(() => unescapeFieldPath(invalidPath), { message: `Invalid escape sequence in field path '${invalidPath}'; '&' may not appear at the end of the path` });
      });
      fc.assert(prop);
    });

    it('should error if there is an empty path segment' , () => {
      assert.throws(() => unescapeFieldPath('a..b'), { message: `Invalid field path 'a..b'; empty segment found at position 2` });

      const arb = fc.tuple(NEStringPathSegArb, NEStringPathSegArb).map(([s1, s2]) => [s1.length + 1, `${s1}..${s2}`] as const);

      const prop = fc.property(arb, ([errorPos, invalidPath]) => {
        assert.throws(() => unescapeFieldPath(invalidPath), { message: `Invalid field path '${invalidPath}'; empty segment found at position ${errorPos}` });
      });
      fc.assert(prop);
    });

    it('should error if there is a standalone &', () => {
      assert.throws(() => unescapeFieldPath('a&b.'), { message: `Invalid escape sequence in field path 'a&b.' at position 1; '&' may not appear alone (must be used as either '&&' or '&.')` });

      const arb = fc.tuple(NEStringPathSegArb, NEStringPathSegArb).map(([s1, s2]) => [s1.length, `${s1}&${s2}`] as const);

      const prop = fc.property(arb, ([errorPos, invalidPath]) => {
        assert.throws(() => unescapeFieldPath(invalidPath), { message: `Invalid escape sequence in field path '${invalidPath}' at position ${errorPos}; '&' may not appear alone (must be used as either '&&' or '&.')` });
      });
      fc.assert(prop);
    });
  });

  it('should function as a pair of adjoint functors or something idk', () => {
    const arb = PathSegmentsArb.filter(a => a.length > 0);

    fc.assert(
      fc.property(arb, (arr) => {
        const result = escapeFieldNames(...arr);

        assert.strictEqual(typeof result, 'string'); // type
        assert.strictEqual(result, escapeFieldNames(...arr)); // determinism

        const parts = unescapeFieldPath(result);

        assert.ok(Array.isArray(parts)); // type
        assert.strictEqual(parts.length, arr.length); // same num parts

        arr.forEach((original, i) => {
          const unescaped = parts[i];

          if (typeof original === 'number') {
            assert.strictEqual(unescaped, String(original)); // num is unchanged
          } else if (typeof original === 'string') {
            assert.strictEqual(unescaped, original); // each part can be individually escaped and remain the same
          }
        });
      }),
    );
  });
});
