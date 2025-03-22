import type { Monoid, MonoidalOptionsHandler } from '@/src/lib/opts-handlers.js';
import { it } from '@/tests/testlib/test-fns/it.js';
import assert from 'assert';
import fc from 'fast-check';
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

const monoid = <T>(handler: Monoid<T>, valueArb: fc.Arbitrary<NoInfer<T>>) => {
  it('should return the empty value when nothing to concat', () => {
    assert.deepStrictEqual(handler.concat([]), handler.empty);
  });

  it('should return the same element when only one config is provided', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        assert.deepStrictEqual(handler.concat([value]), value);
      }),
    );
  });

  it('should be associative', () => {
    fc.assert(
      fc.property(valueArb, valueArb, valueArb, (a, b, c) => {
        assert.deepStrictEqual(
          handler.concat([a, handler.concat([b, c])]),
          handler.concat([handler.concat([a, b]), c]),
        );
      }),
    );
  });

  it('should follow identity laws', () => {
    fc.assert(
      fc.property(valueArb, (layer) => {
        assert.deepStrictEqual(handler.concat([layer, handler.empty]), layer);
        assert.deepStrictEqual(handler.concat([handler.empty, layer]), layer);
      }),
    );
    assert.deepStrictEqual(handler.concat([handler.empty, handler.empty]), handler.empty);
  });
};

export const validateLawsOf = { monoid };
