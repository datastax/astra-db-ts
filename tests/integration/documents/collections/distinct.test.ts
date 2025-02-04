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

import { it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.documents.collections.distinct', { truncate: 'colls:before' }, ({ collection, collection_ }) => {
  before(async () => {
    await collection.insertMany([
      { username: { full: 'a' }, car: [{ num: 1 }] },
      { username: { full: 'b' }, car: [{ num: 2 }, { num: 3 }] },
      { username: { full: 'a' }, car: [{ num: 2 }], bus: 'no' },
      { username: { full: 'a' }, car: [{ num: 2, str: 'hi!' }], bus: 'no' },
    ]);

    await collection_.insertOne({
      x: [{ y: 'Y', 0: 'ZERO' }],
    });
  });

  it('rejects invalid paths', async () => {
    await assert.rejects(async () => {
      await collection.distinct('', {});
    });

    await assert.rejects(async () => {
      await collection.distinct('.', {});
    });

    await assert.rejects(async () => {
      await collection.distinct('a.1..b', {});
    });

    await assert.rejects(async () => {
      await collection.distinct('a.1..b', {});
    });

    await assert.rejects(async () => {
      await collection.distinct('a..b.c', {});
    });

    await assert.rejects(async () => {
      await collection.distinct('a.b..c', {});
    });
  });

  it('can distinct on top-level elem', async () => {
    const distinct = await collection.distinct('username', {});
    assert.strictEqual(distinct.length, 2);
    assert.ok(distinct.some(v => v.full === 'a'));
    assert.ok(distinct.some(v => v.full === 'b'));
  });

  it('can distinct on nested elem', async () => {
    const distinct = await collection.distinct('username.full', {});
    assert.strictEqual(distinct.length, 2);
    assert.ok(distinct.includes('a'));
    assert.ok(distinct.includes('b'));
  });

  it('can distinct on potentially missing field', async () => {
    const distinct = await collection.distinct('bus', {});
    assert.deepStrictEqual(distinct, ['no']);
  });

  it('can distinct on array', async () => {
    const distinct = await collection.distinct('car', {});
    assert.strictEqual(distinct.length, 4);
    assert.ok(distinct.some(c => c.num === 1));
    assert.ok(distinct.some(c => c.num === 2 && !c.str));
    assert.ok(distinct.some(c => c.num === 2 && c.str));
    assert.ok(distinct.some(c => c.num === 3));
  });

  it('can distinct in array', async () => {
    const distinct1 = await collection.distinct('car.0', {});
    assert.strictEqual(distinct1.length, 3);
    assert.ok(distinct1.some(c => c.num === 1));
    assert.ok(distinct1.some(c => c.num === 2 && !c.str));
    assert.ok(distinct1.some(c => c.num === 2 && c.str));

    const distinct2 = await collection.distinct('car.0.num', {});
    assert.strictEqual(distinct2.length, 2);
    assert.ok(distinct2.includes(1));
    assert.ok(distinct2.includes(2));
  });

  it('does the weird ambiguous number path thing correctly', async () => {
    const distinct1 = await collection_.distinct('x.y', {});
    assert.deepStrictEqual(distinct1, ['Y']);

    const distinct2 = await collection_.distinct('x.0', {});
    assert.deepStrictEqual(distinct2, [{ y: 'Y', 0: 'ZERO' }]);

    const distinct3 = await collection_.distinct('x.0.y', {});
    assert.deepStrictEqual(distinct3, ['Y']);

    const distinct4 = await collection_.distinct('x.0.0', {});
    assert.deepStrictEqual(distinct4, ['ZERO']);
  });
});
