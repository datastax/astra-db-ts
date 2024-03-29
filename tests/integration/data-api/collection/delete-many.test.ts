// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Collection } from '@/src/data-api';
import { initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.delete-many', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  afterEach(async () => {
    await collection.deleteAll();
  });

  it('should deleteMany when match is <= 20', async () => {
    const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    docList.forEach((doc, index) => {
      doc.username = doc.username + (index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 20);
    const deleteManyResp = await collection.deleteMany({ 'city': 'trichy' });
    assert.strictEqual(deleteManyResp.deletedCount, 20);
  });

  it('should deleteMany when match is > 20', async () => {
    const docList = Array.from({ length: 101 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 101);
    const deleteManyResp = await collection.deleteMany({ 'city': 'trichy' });
    assert.strictEqual(deleteManyResp.deletedCount, 101);
  });

  it('should throw an error when deleting with an empty filter', async () => {
    await assert.rejects(
      async () => collection.deleteMany({}),
      /Can't pass an empty filter to deleteMany, use deleteAll instead if you really want to delete everything/
    );
  });

  it('should find with sort', async () => {
    await collection.deleteAll();
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' }
    ]);

    let docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['a', 'b', 'c']);

    docs = await collection.find({}, { sort: { username: -1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['c', 'b', 'a']);
  });

  it('should findOne with sort', async () => {
    await collection.deleteAll();
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' }
    ]);

    let doc = await collection.findOne({}, { sort: { username: 1 } });
    assert.strictEqual(doc!.username, 'a');

    doc = await collection.findOne({}, { sort: { username: -1 } });
    assert.deepStrictEqual(doc!.username, 'c');
  });

  it('should findOneAndUpdate with sort', async () => {
    await collection.deleteAll();
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' }
    ]);

    let res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'aaa' } },
      { sort: { username: 1 }, returnDocument: 'before', includeResultMetadata: true }
    );
    assert.strictEqual(res.value!.username, 'a');

    res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'ccc' } },
      { sort: { username: -1 }, returnDocument: 'before', includeResultMetadata: true }
    );
    assert.deepStrictEqual(res.value!.username, 'c');
  });

  it('should findOneAndReplace with sort', async () => {
    await collection.deleteAll();
    await collection.insertMany([
      { username: 'a', answer: 42 },
      { username: 'c', answer: 42 },
      { username: 'b', answer: 42 }
    ]);

    let res = await collection.findOneAndReplace(
      {},
      { username: 'aaa' },
      { sort: { username: 1 }, returnDocument: 'before', includeResultMetadata: true }
    );
    assert.strictEqual(res.value!.username, 'a');

    res = await collection.findOneAndReplace(
      {},
      { username: 'ccc' },
      { sort: { username: -1 }, returnDocument: 'before', includeResultMetadata: true }
    );
    assert.deepStrictEqual(res.value!.username, 'c');

    const docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.answer), [undefined, 42, undefined]);
  });

  it('findOneAndReplace should not return metadata when includeResultMetadata is false', async () => {
    await collection.insertOne({ username: 'a' });

    const res = await collection.findOneAndReplace(
      { username: 'a' },
      { username: 'b' },
      { returnDocument: 'after', includeResultMetadata: false }
    );
    assert.strictEqual(res?.username, 'b');
  });

  it('findOneAndReplace should not return metadata by default', async () => {
    await collection.insertOne({ username: 'a' });

    const res = await collection.findOneAndReplace(
      { username: 'a' },
      { username: 'b' },
      { returnDocument: 'after' }
    );
    assert.strictEqual(res?.username, 'b');
  });

  it('should findOneAndUpdate without any updates to apply', async () => {
    await collection.insertMany([
      { username: 'a' }
    ]);

    const res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'a' } },
      { sort: { username: 1 }, returnDocument: 'before', includeResultMetadata: true }
    );
    assert.strictEqual(res.value!.username, 'a');
  });

  it('should findOneAndUpdate with a projection', async () => {
    await collection.insertMany([
      { username: 'a', answer: 42 },
      { username: 'aa', answer: 42 },
      { username: 'aaa', answer: 42 }
    ]);

    const res = await collection.findOneAndUpdate(
      { username: 'a' },
      { $set: { username: 'b' } },
      { projection: { username: 1 }, returnDocument: 'after', includeResultMetadata: true }
    );
    assert.strictEqual(res.value!.username, 'b');
    assert.strictEqual(res.value!.answer, undefined);
  });

  it('should countDocuments()', async () => {
    await collection.insertMany([
      { username: 'a' },
      { username: 'aa', answer: 42 },
      { username: 'aaa', answer: 42 }
    ]);

    let count = await collection.countDocuments({}, 1000);
    assert.strictEqual(count, 3);

    count = await collection.countDocuments({ username: 'a' }, 1000);
    assert.strictEqual(count, 1);

    count = await collection.countDocuments({ answer: 42 }, 1000);
    assert.strictEqual(count, 2);
  });

  it('supports findOneAndDelete()', async () => {
    await collection.deleteAll();
    await collection.insertMany([
      { username: 'a' },
      { username: 'b' },
      { username: 'c' }
    ]);

    let res = await collection.findOneAndDelete({ username: 'a' }, { includeResultMetadata: true });
    assert.strictEqual(res.value!.username, 'a');

    res = await collection.findOneAndDelete({}, { sort: { username: -1 }, includeResultMetadata: true });
    assert.strictEqual(res.value!.username, 'c');
  });

  it('stores BigInts as numbers', async () => {
    await collection.deleteAll();
    await collection.insertOne({
      _id: 'bigint-test',
      answer: 42n
    });

    const res = await collection.findOne({ _id: 'bigint-test' });
    assert.strictEqual(res!.answer, 42);
  });

  it('should deleteOne with sort', async () => {
    await collection.deleteAll();
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' }
    ]);

    await collection.deleteOne(
      {},
      { sort: { username: 1 } }
    );

    const docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['b', 'c']);
  });

  it('should updateOne with sort', async () => {
    await collection.deleteAll();
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' }
    ]);

    await collection.updateOne(
      {},
      { $set: { username: 'aa' } },
      { sort: { username: 1 } }
    );

    const docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['aa', 'b', 'c']);
  });
});
