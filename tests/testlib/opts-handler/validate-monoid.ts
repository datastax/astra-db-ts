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

import { it } from '@/tests/testlib';
import assert from 'assert';
import { MonoidalOptionsHandler } from '@/src/lib/opts-handler';

export const ensureMonoidalHandlerIsActuallyAMonoid = (handler: MonoidalOptionsHandler<any>, configs: any[]) => {
  if (configs.length < 3) {
    throw new Error('Need at least 3 configs to test associativity');
  }

  it('should return the empty value when nothing to concat', () => {
    assert.deepStrictEqual(handler.concat(), handler.empty);
  });

  it('should be associative', () => {
    for (let i = 0; i < configs.length; i++) {
      for (let j = 0; j < configs.length; j++) {
        for (let k = 0; k < configs.length; k++) {
          assert.deepStrictEqual(
            handler.concat(configs[i], handler.concat(configs[j], configs[k])),
            handler.concat(handler.concat(configs[i], configs[j]), configs[k]),
          );
        }
      }
    }
  });

  it('should have a valid identity element', () => {
    for (const layer of configs) {
      assert.deepStrictEqual(handler.concat(layer, handler.empty), layer);
      assert.deepStrictEqual(handler.concat(handler.empty, layer), layer);
    }
    assert.deepStrictEqual(handler.concat(handler.empty, handler.empty), handler.empty);
  });
};
