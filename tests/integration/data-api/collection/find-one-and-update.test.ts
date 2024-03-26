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
import { createSampleDocWithMultiLevel, testClient } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.find-one-and-update', () => {
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


  it('should findOneAndUpdate', async () => {
    const res = await collection.insertOne(createSampleDocWithMultiLevel());
    const docId = res.insertedId;
    const findOneAndUpdateResp = await collection.findOneAndUpdate(
      {
        '_id': docId
      },
      {
        '$set': {
          'username': 'aaronm'
        },
        '$unset': {
          'address.city': ''
        }
      },
      {
        returnDocument: 'after',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(findOneAndUpdateResp.ok, 1);
    assert.strictEqual(findOneAndUpdateResp.value!._id, docId);
    assert.strictEqual(findOneAndUpdateResp.value!.username, 'aaronm');
    assert.strictEqual(findOneAndUpdateResp.value!.address.city, undefined);
  });

  it('should findOneAndUpdate with returnDocument before', async () => {
    const docToInsert = createSampleDocWithMultiLevel();
    const res = await collection.insertOne(docToInsert);
    const docId = res.insertedId;
    const cityBefore = docToInsert.address?.city;
    const usernameBefore = docToInsert.username;
    const findOneAndUpdateResp = await collection.findOneAndUpdate(
      {
        '_id': docId,
      },
      {
        '$set': {
          'username': 'aaronm'
        },
        '$unset': {
          'address.city': ''
        }
      },
      {
        returnDocument: 'before',
        includeResultMetadata: true,
      }
    );
    assert.strictEqual(findOneAndUpdateResp.ok, 1);
    assert.strictEqual(findOneAndUpdateResp.value!._id, docId);
    assert.strictEqual(findOneAndUpdateResp.value!.username, usernameBefore);
    assert.strictEqual(findOneAndUpdateResp.value!.address.city, cityBefore);
  });

  it('should findOneAndUpdate with upsert true', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const newDocId = '123';
    const findOneAndUpdateResp = await collection.findOneAndUpdate(
      {
        '_id': newDocId,
      },
      {
        '$set': {
          'username': 'aaronm'
        },
        '$unset': {
          'address.city': ''
        }
      },
      {
        includeResultMetadata: true,
        returnDocument: 'after',
        upsert: true,
      }
    );
    assert.strictEqual(findOneAndUpdateResp.ok, 1);
    assert.strictEqual(findOneAndUpdateResp.value!._id, newDocId);
    assert.strictEqual(findOneAndUpdateResp.value!.username, 'aaronm');
    assert.strictEqual(findOneAndUpdateResp.value!.address, undefined);
  });

  it('should findOneAndUpdate with upsert true and returnDocument before', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const newDocId = '123';
    const findOneAndUpdateResp = await collection.findOneAndUpdate(
      {
        '_id': newDocId,
      },
      {
        '$set': {
          'username': 'aaronm'
        },
        '$unset': {
          'address.city': ''
        }
      },
      {
        includeResultMetadata: true,
        returnDocument: 'before',
        upsert: true
      }
    );
    assert.strictEqual(findOneAndUpdateResp.ok, 1);
    assert.strictEqual(findOneAndUpdateResp.value, null);
  });

  it('should not return metadata when includeResultMetadata is false', async () => {
    await collection.insertOne({ username: 'a' });
    const res = await collection.findOneAndUpdate(
      { username: 'a' },
      { $set: { username: 'b' } },
      { returnDocument: 'after', includeResultMetadata: false }
    );

    assert.deepStrictEqual(res, { _id: res?._id, username: 'b' });
  });

  it('should not return metadata by default', async () => {
    await collection.insertOne({ username: 'a' });
    const res = await collection.findOneAndUpdate(
      { username: 'a' },
      { $set: { username: 'b' } },
      { returnDocument: 'after' }
    );

    assert.deepStrictEqual(res, { _id: res?._id, username: 'b' });
  });
});
