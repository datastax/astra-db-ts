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
import { TimeoutManager } from '@/src/lib/api/timeout-managers';
import { describe, it } from '@/tests/testlib';

describe('unit.lib.api.timeout-manager', () => {
  it('works', async () => {
    const timeoutManager = new TimeoutManager(1000, () => new Error('timeout'));
    assert.strictEqual(timeoutManager.msRemaining(), 1000);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.ok(timeoutManager.msRemaining() < 510);
    assert.ok(timeoutManager.msRemaining() > 480);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.ok(timeoutManager.msRemaining() < 20);
    assert.ok(timeoutManager.msRemaining() > -40);
  });
});
