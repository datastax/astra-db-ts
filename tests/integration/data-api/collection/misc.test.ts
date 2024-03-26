// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Collection, DataAPITimeout, Db } from '@/src/data-api';
import { DEFAULT_COLLECTION_NAME, testClient } from '@/tests/fixtures';
import assert from 'assert';
import { DEFAULT_NAMESPACE } from '@/src/api';

describe('integration.data-api.collection.misc', () => {
  let db: Db;
  let collection: Collection;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }
    [, db, collection] = await testClient.new();
  });

  describe('initialization', () => {
    it('should initialize a Collection', () => {
      const collection = new Collection(db, db['_httpClient'], 'new_collection', DEFAULT_NAMESPACE);
      assert.ok(collection);
    });
  });

  describe('accessors', () => {
    it('returns the namespace', () => {
      assert.strictEqual(collection.namespace, DEFAULT_NAMESPACE);
    });

    it('returns the name', () => {
      assert.strictEqual(collection.collectionName, DEFAULT_COLLECTION_NAME);
    });
  });

  describe('timeout', () => {
    it('times out on http2', async () => {
      const [, newDb] = await testClient!.new(true);

      try {
        await newDb.collection(DEFAULT_COLLECTION_NAME).insertOne({ username: 'test' }, { maxTimeMS: 10 });
      } catch (e: any) {
        assert.ok(e instanceof DataAPITimeout);
        assert.strictEqual(e.message, 'Command timed out after 10ms');
      }
    });

    it('times out on http1', async () => {
      const [, newDb] = await testClient!.new(false);

      try {
        await newDb.collection(DEFAULT_COLLECTION_NAME).insertOne({ username: 'test' }, { maxTimeMS: 10 });
      } catch (e: any) {
        assert.ok(e instanceof DataAPITimeout);
        assert.strictEqual(e.message, 'Command timed out after 10ms');
      }
    });
  });
});
