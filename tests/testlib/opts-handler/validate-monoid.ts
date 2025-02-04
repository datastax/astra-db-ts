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

import { it } from '@/tests/testlib/index.js';
import assert from 'assert';
import type { MonoidalOptionsHandler } from '@/src/lib/opts-handler.js';

export const ensureMonoidalHandlerIsActuallyAMonoid = (handler: MonoidalOptionsHandler<any>, configs: any[]) => {
  if (configs.length < 3) {
    throw new Error('Need at least 3 configs to test associativity');
  }

  it('should return the empty value when nothing to concat', () => {
    assert.deepStrictEqual(handler.concat([]), handler.empty);
  });

  it('should return the same element when only one config is provided', () => {
    for (const config of configs) {
      assert.deepStrictEqual(handler.concat([config]), config);
    }
  });

  it('should be associative', () => {
    for (let i = 0; i < Math.min(16, configs.length); i++) {
      const a = configs[~~(Math.random() * configs.length)];
      const b = configs[~~(Math.random() * configs.length)];
      const c = configs[~~(Math.random() * configs.length)];

      assert.deepStrictEqual(
        handler.concat([a, handler.concat([b, c])]),
        handler.concat([handler.concat([a, b]), c]),
      );
    }
  });

  it('should have a valid identity element', () => {
    for (const layer of configs) {
      assert.deepStrictEqual(handler.concat([layer, handler.empty]), layer);
      assert.deepStrictEqual(handler.concat([handler.empty, layer]), layer);
    }
    assert.deepStrictEqual(handler.concat([handler.empty, handler.empty]), handler.empty);
  });
};
