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
import { createSampleDoc2WithMultiLevel, createSampleDocWithMultiLevel, testClient } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.replace-one', () => {
  let collection: Collection;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }
    [, , collection] = await testClient.new();
  });

  afterEach(async () => {
    await collection.deleteAll();
  });

  it('should replaceOne document by id', async () => {
    const doc = createSampleDocWithMultiLevel();
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const newDoc = createSampleDoc2WithMultiLevel();
    const replaceOneResp = await collection.replaceOne({ '_id': idToCheck }, newDoc);
    assert.strictEqual(replaceOneResp.modifiedCount, 1);
    assert.strictEqual(replaceOneResp.matchedCount, 1);
    assert.strictEqual(replaceOneResp.upsertedId, undefined);
    assert.strictEqual(replaceOneResp.upsertedCount, undefined);
    const replacedDoc = await collection.findOne({ 'username': 'jimr' });
    assert.ok(replacedDoc!._id);
    assert.strictEqual(replacedDoc!._id, idToCheck);
    assert.strictEqual(replacedDoc!.username, 'jimr');
    assert.strictEqual(replacedDoc!.address.city, 'nyc');
  });

  it('should replaceOne document by col', async () => {
    const doc = createSampleDocWithMultiLevel();
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const newDoc = createSampleDoc2WithMultiLevel();
    const replaceOneResp = await collection.replaceOne({ 'address.city': 'big banana' }, newDoc);
    assert.strictEqual(replaceOneResp.modifiedCount, 1);
    assert.strictEqual(replaceOneResp.matchedCount, 1);
    assert.strictEqual(replaceOneResp.upsertedId, undefined);
    assert.strictEqual(replaceOneResp.upsertedCount, undefined);
    const replacedDoc = await collection.findOne({ 'username': 'jimr' });
    assert.ok(replacedDoc!._id);
    assert.strictEqual(replacedDoc!._id, idToCheck);
    assert.strictEqual(replacedDoc!.username, 'jimr');
    assert.strictEqual(replacedDoc!.address.city, 'nyc');
  });

  it('should upsert a doc with upsert flag true in replaceOne call', async () => {
    const doc = createSampleDocWithMultiLevel();
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const newDoc = createSampleDoc2WithMultiLevel();
    const replaceOneResp = await collection.replaceOne({ 'address.city': 'nyc' }, newDoc, { 'upsert': true });
    assert.strictEqual(replaceOneResp.modifiedCount, 0);
    assert.strictEqual(replaceOneResp.matchedCount, 0);
    assert.ok(replaceOneResp.upsertedId);
    assert.strictEqual(replaceOneResp.upsertedCount, 1);
    const replacedDoc = await collection.findOne({ 'address.city': 'nyc' });
    assert.ok(replacedDoc!._id);
    assert.notStrictEqual(replacedDoc!._id, idToCheck);
    assert.strictEqual(replacedDoc!.address.city, 'nyc');
  });
});
