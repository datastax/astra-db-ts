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

import { describe, it } from '@/tests/testlib/index.js';
import { validateLawsOf } from '@/tests/testlib/laws.js';
import { monoids, OptionParseError, OptionsHandler } from '@/src/lib/opts-handlers.js';
import fc from 'fast-check';
import assert from 'assert';
import { define } from 'decoders';

describe('unit.lib.opts-handlers', () => {
  describe('OptionsHandler', () => {
    it('should parse a valid value', () => {
      fc.assert(
        fc.property(fc.anything(), fc.anything(), (input, output) => {
          const decoder = define<{ output: unknown }>((_, ok) => ok({ output }));
          const handler = new OptionsHandler(decoder);
          assert.deepStrictEqual(handler.parse(input), { output });
        }),
      );
    });

    it('should parse a valid value within an object', () => {
      const objArb = fc.tuple(fc.object({ withNullPrototype: false }), fc.string(), fc.anything())
        .filter(([_, field]) => {
          return !field.includes('.');
        })
        .map(([obj, field, value]) => {
          obj[field] = value;
          return <const>[obj, field, value];
        });

      fc.assert(
        fc.property(objArb, fc.string(), ([obj, field, value], fieldPrefix) => {
          const decoder = define<{ output: unknown }>((input, ok) => ok({ output: input }));
          const handler = new OptionsHandler(decoder);
          assert.deepStrictEqual(handler.parseWithin(obj, `${fieldPrefix}.${field}`), { output: value });
        }),
      );
    });

    it('should throw a OptionParseError on a decoding failure', () => {
      fc.assert(
        fc.property(fc.anything(), fc.string(), (input, errMsg) => {
          const decoder = define<{ value: unknown }>((_, __, err) => err(errMsg));
          const handler = new OptionsHandler(decoder);

          assert.throws(() => handler.parse(input), (err) => {
            assert.ok(err instanceof OptionParseError);
            assert.ok(err.message.includes(errMsg));
            return true;
          });
        }),
      );
    });

    it('should throw a OptionParseError with a prefixed message on a decoding failure if field present', () => {
      fc.assert(
        fc.property(fc.anything(), fc.string(), fc.string(), (input, errMsg, field) => {
          const decoder = define<{ value: unknown }>((_, __, err) => err(errMsg));
          const handler = new OptionsHandler(decoder);

          assert.throws(() => handler.parse(input, field), (err) => {
            assert.ok(err instanceof OptionParseError);
            assert.ok(err.message.startsWith(`Error parsing '${field}': `));
            assert.ok(err.message.includes(errMsg));
            return true;
          });
        }),
      );
    });

    it('should rethrow the underlying error if not a decoding error when parsing', () => {
      fc.assert(
        fc.property(fc.anything(), fc.string(), (input, errMsg) => {
          const decoder = define<{ value: unknown }>(() => {
            throw new Error(errMsg);
          });
          const handler = new OptionsHandler(decoder);

          assert.throws(() => handler.parse(input), (err) => {
            assert.ok(err instanceof Error);
            assert.ok(!(err instanceof OptionParseError));
            assert.strictEqual(err.message, errMsg);
            return true;
          });
        }),
      );
    });
  });

  describe('monoids', () => {
    describe('optional', () => {
      const nonNullArb = fc.option(fc.anything().filter((x) => x !== null), { nil: undefined });

      it('should find the right-most non-undefined value', () => {
        fc.assert(
          fc.property(fc.array(nonNullArb), (values) => {
            const result = monoids.optional().concat(values);
            assert.strictEqual(result, values.reverse().find((x) => x !== undefined));
          }),
        );
      });

      validateLawsOf.monoid(monoids.optional(), nonNullArb);
    });

    describe('array', () => {
      it('should append elements to the end of the array', () => {
        fc.assert(
          fc.property(fc.array(fc.array(fc.anything())), (arrays) => {
            const result = monoids.array().concat(arrays);
            assert.deepStrictEqual(result, arrays.flat());
          }),
        );
      });

      validateLawsOf.monoid(monoids.array(), fc.array(fc.anything()));
    });

    describe('prependingArray', () => {
      it('should prepend elements to the beginning of the array', () => {
        fc.assert(
          fc.property(fc.array(fc.array(fc.anything())), (arrays) => {
            const result = monoids.prependingArray().concat(arrays);
            assert.deepStrictEqual(result, arrays.reverse().flat());
          }),
        );
      });

      validateLawsOf.monoid(monoids.prependingArray(), fc.array(fc.anything()));
    });

    describe('object', () => {
      const monoid = monoids.object({
        arr: monoids.array(),
        preArr: monoids.prependingArray(),
        opt: monoids.optional(),
        obj: monoids.object({
          nestedArray: monoids.array(),
        }),
      });

      const arb = fc.record({
        arr: fc.array(fc.array(fc.anything())),
        preArr: fc.array(fc.array(fc.anything())),
        opt: fc.option(fc.anything().filter((x) => x !== null), { nil: undefined }),
        obj: fc.record({
          nestedArray: fc.array(fc.array(fc.anything())),
        }, {
          noNullPrototype: true,
        }),
      }, {
        noNullPrototype: true,
      });

      validateLawsOf.monoid(monoid, arb);
    });
  });
});
