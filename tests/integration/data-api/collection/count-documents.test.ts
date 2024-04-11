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

import { Collection, TooManyDocumentsToCountError } from '@/src/data-api';
import { initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.count-documents', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async () => {
    await collection.deleteAll();
  });

  it('works', async () => {
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

  it('should return count of documents with non id filter', async () => {
    const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    docList.forEach((doc, index) => {
      doc.username = doc.username + (index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 20);
    const count = await collection.countDocuments({ 'city': 'trichy' }, 1000);
    assert.strictEqual(count, 20);
  });

  it('should return count of documents with no filter', async () => {
    const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    docList.forEach((doc, index) => {
      doc.username = doc.username + (index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 20);
    const count = await collection.countDocuments({}, 1000);
    assert.strictEqual(count, 20);
  });

  it('should return count of documents for more than default page size limit', async () => {
    const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    docList.forEach((doc, index) => {
      doc.username = doc.username + (index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 20);
    //insert next 20
    const docListNextSet = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
    docListNextSet.forEach((doc, index) => {
      doc.username = doc.username + (index + 21);
    });
    const resNextSet = await collection.insertMany(docListNextSet);
    assert.strictEqual(resNextSet.insertedCount, docListNextSet.length);
    assert.strictEqual(Object.keys(resNextSet.insertedIds).length, docListNextSet.length);
    //verify counts
    assert.strictEqual(await collection.countDocuments({ city: 'nyc' }, 1000), 20);
    assert.strictEqual(await collection.countDocuments({ city: 'trichy' }, 1000), 20);
    assert.strictEqual(await collection.countDocuments({ city: 'chennai' }, 1000), 0);
    assert.strictEqual(await collection.countDocuments({}, 1000), 40);
  });

  it('should return 0 when no documents are in the collection', async () => {
    const count = await collection.countDocuments({}, 1000);
    assert.strictEqual(count, 0);
  });

  it('should throw an error when # docs over limit', async () => {
    const docList = Array.from({ length: 2 }, () => ({}));
    await collection.insertMany(docList);

    try {
      await collection.countDocuments({}, 1);
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof TooManyDocumentsToCountError);
      assert.strictEqual(e.limit, 1);
      assert.strictEqual(e.hitServerLimit, false);
    }
  });

  it('should throw an error when moreData is returned', async () => {
    const docList = Array.from({ length: 1001 }, () => ({}));
    await collection.insertMany(docList);

    try {
      await collection.countDocuments({}, 2000);
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof TooManyDocumentsToCountError);
      assert.strictEqual(e.limit, 1000);
      assert.strictEqual(e.hitServerLimit, true);
    }
  });

  it('should throw an error when no limit is provided', () => {
    assert.rejects(async () => {
      // @ts-expect-error - intentionally testing invalid input
      return await collection.countDocuments({});
    })
  });
});
