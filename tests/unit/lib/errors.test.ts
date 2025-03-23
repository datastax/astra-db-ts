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
import { jsonTryStringify } from '@/src/lib/utils.js';
import fc from 'fast-check';
import { NonErrorError } from '@/src/lib/errors.js';
import { betterTypeOf } from '@/src/documents/utils.js';

describe('unit.lib.errors', () => {
  describe('NonErrorError', () => {
    describe('asError', () => {
      it('converts non-errors into errors', () => {
        fc.assert(
          fc.property(fc.anything(), (value) => {
            fc.pre(!(value instanceof Error));

            if (value && typeof value === 'object' && 'toString' in value) {
              fc.pre(typeof value.toString === 'function');
            }

            const error = NonErrorError.asError(value);
            assert.ok(error instanceof NonErrorError);
            assert.strictEqual(error.message, `Non-error value thrown; type='${betterTypeOf(value)}' toString='${value}' JSON.stringified='${jsonTryStringify(value, `${value}`)}'`);
            assert.strictEqual(error.value, value);
          }),
        );
      });

      it('should have any error as its fixed-point', () => {
        const errorsArb = fc.oneof(
          fc.string().chain((message) => {
            return fc.constantFrom(
              new Error(message),
              new TypeError(message),
              NonErrorError.asError(new Error(message)),
              NonErrorError.asError(message),
            );
          }),
          fc.anything().map((value) => {
              return NonErrorError.asError(value);
            },
          ),
        );

        fc.assert(
          fc.property(errorsArb, (error) => {
            if (error && typeof error === 'object' && 'toString' in error) {
              fc.pre(typeof error.toString === 'function');
            }

            for (let i = 0; i < 10; i++) {
              const nextError = NonErrorError.asError(error);
              assert.strictEqual(nextError, error);
            }
          }),
        );
      });
    });
  });
});
