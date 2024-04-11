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

import { Collection } from '@/src/data-api';
import { createSampleDoc2WithMultiLevel, createSampleDocWithMultiLevel, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.replace-one', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async () => {
    await collection.deleteAll();
  });

  it('should replaceOne', async () => {
    const res = await collection.insertOne(createSampleDocWithMultiLevel());
    const docId = res.insertedId;
    const resp = await collection.replaceOne(
      {
        '_id': docId,
      },
      createSampleDoc2WithMultiLevel(),
    );
    assert.strictEqual(resp.matchedCount, 1);
    assert.strictEqual(resp.modifiedCount, 1);
  });

  it('should replaceOne with same doc', async () => {
    const res = await collection.insertOne(createSampleDocWithMultiLevel());
    const docId = res.insertedId;
    const resp = await collection.replaceOne(
      {
        '_id': docId,
      },
      createSampleDocWithMultiLevel(),
    );
    assert.strictEqual(resp.matchedCount, 1);
    assert.strictEqual(resp.modifiedCount, 0);
  });

  it('should replaceOne with multiple matches', async () => {
    await collection.insertMany([
      createSampleDocWithMultiLevel(),
      createSampleDocWithMultiLevel(),
    ]);

    const resp = await collection.replaceOne(
      {
        username: 'aaron',
      },
      createSampleDoc2WithMultiLevel(),
    );

    assert.strictEqual(resp.matchedCount, 1);
    assert.strictEqual(resp.modifiedCount, 1);
  });

  it('should replaceOne with upsert true', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const newDocId = '123';
    const resp = await collection.replaceOne(
      {
        '_id': newDocId,
      },
      createSampleDoc2WithMultiLevel(),
      {
        upsert: true,
      },
    );

    assert.strictEqual(resp.matchedCount, 0);
    assert.strictEqual(resp.modifiedCount, 0);
    assert.strictEqual(resp.upsertedCount, 1);
    assert.strictEqual(resp.upsertedId, newDocId);
  });

  it('should replaceOne with an empty doc', async () => {
    await collection.insertMany([
      { username: 'a' },
    ]);

    const res = await collection.replaceOne(
      { username: 'a' },
      {},
    );
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);
  });

  it('should replaceOne with sort', async () => {
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' },
    ]);

    let res = await collection.replaceOne(
      {},
      { username: 'aaa' },
      { sort: { username: 1 } },
    )
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);

    res = await collection.replaceOne(
      {},
      { username: 'ccc' },
      { sort: { username: -1 } },
    );
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);

    const found = await collection.find({}).toArray();
    assert.deepStrictEqual(found.map(d => d.username).sort(), ['aaa', 'b', 'ccc']);
  });

  it('should replaceOne with $vector sort', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.replaceOne(
      {},
      { username: 'aaa' },
      { sort: { $vector: [1, 1, 1, 1, 1] } },
    );
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);
  });

  it('should replaceOne with vector sort in option', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.replaceOne(
      {},
      { username: 'aaa' },
      { vector: [1, 1, 1, 1, 1] },
    );
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);
  });

  it('should error when both sort and vector are provided', async () => {
    await assert.rejects(async () => {
      await collection.replaceOne({}, {}, { sort: { username: 1 }, vector: [1, 1, 1, 1, 1] });
    }, /Can't use both `sort` and `vector` options at once; if you need both, include a \$vector key in the sort object/)
  });

  it('should error when both sort and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.replaceOne({}, {}, { sort: { username: 1 }, vectorize: 'American Idiot is a good song' });
    }, /Can't use both `sort` and `vectorize` options at once; if you need both, include a \$vectorize key in the sort object/)
  });

  it('should error when both vector and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.replaceOne({}, {}, { vector: [1, 1, 1, 1, 1], vectorize: 'American Idiot is a good song' });
    }, /Cannot set both vectors and vectorize options/)
  });
});
