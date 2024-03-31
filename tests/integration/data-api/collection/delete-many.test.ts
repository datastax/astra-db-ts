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

import { Collection, DataAPIError, DeleteManyError, UpdateManyError } from '@/src/data-api';
import { initCollectionWithFailingClient, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.delete-many', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async () => {
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

  it('fails gracefully on 2XX exceptionsaa', async () => {
    try {
      await collection.deleteMany({ $invalidOperator: 1 })
      assert.fail('Expected error');
    } catch (e) {
      assert.ok(e instanceof DeleteManyError);
      assert.strictEqual(e.errorDescriptors[0].errorCode, 'INVALID_FILTER_EXPRESSION');
      assert.strictEqual(e.detailedErrorDescriptors[0].errorDescriptors[0].errorCode, 'INVALID_FILTER_EXPRESSION');
      assert.strictEqual(e.errorDescriptors.length, 1);
      assert.strictEqual(e.detailedErrorDescriptors.length, 1);
      assert.deepStrictEqual(e.partialResult, { deletedCount: 0 });
      assert.deepStrictEqual(e.errorDescriptors[0].attributes, {});
    }
  });

  it('fails fast on hard errors', async function () {
    const collection = await initCollectionWithFailingClient(this);
    try {
      await collection.deleteMany({ _id: 3 });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });
});
