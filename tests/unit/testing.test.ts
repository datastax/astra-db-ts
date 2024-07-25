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

import { it, parallel } from '@/tests/test-utils';
import assert from 'assert';

parallel('unit.testing', () => {
  it('abc', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('abc')
    assert.equal(1, 1);
  });

  it('123', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('123')
    assert.equal(1, 1);
  });
});
