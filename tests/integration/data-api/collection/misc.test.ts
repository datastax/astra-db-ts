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
import { DEFAULT_COLLECTION_NAME, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';
import { DEFAULT_NAMESPACE } from '@/src/api';
import { CollectionNotFoundError } from '@/src/data-api/errors';

describe('integration.data-api.collection.misc', () => {
  let db: Db;
  let collection: Collection;

  before(async function () {
    [, db, collection] = await initTestObjects(this);
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
    it('times out on http2', async function () {
      const [, newDb] = await initTestObjects(this, true);

      try {
        await newDb.collection(DEFAULT_COLLECTION_NAME).insertOne({ username: 'test' }, { maxTimeMS: 10 });
      } catch (e: any) {
        assert.ok(e instanceof DataAPITimeout);
        assert.strictEqual(e.message, 'Command timed out after 10ms');
      }
    });

    it('times out on http1', async function () {
      const [, newDb] = await initTestObjects(this, false);

      try {
        await newDb.collection(DEFAULT_COLLECTION_NAME).insertOne({ username: 'test' }, { maxTimeMS: 10 });
      } catch (e: any) {
        assert.ok(e instanceof DataAPITimeout);
        assert.strictEqual(e.message, 'Command timed out after 10ms');
      }
    });
  });

  describe('CollectionNotFoundError', () => {
    it('is thrown when doing data api operation on non-existent collection', async () => {
      const collection = db.collection('non_existent_collection');

      try {
        await collection.insertOne({ username: 'test' });
      } catch (e: any) {
        assert.ok(e instanceof CollectionNotFoundError);
        assert.strictEqual(e.namespace, DEFAULT_NAMESPACE);
        assert.strictEqual(e.collectionName, 'non_existent_collection');
      }
    });

    it('is thrown when doing .options() on non-existent collection', async () => {
      const collection = db.collection('non_existent_collection');

      try {
        await collection.options();
      } catch (e: any) {
        assert.ok(e instanceof CollectionNotFoundError);
        assert.strictEqual(e.namespace, DEFAULT_NAMESPACE);
        assert.strictEqual(e.collectionName, 'non_existent_collection');
      }
    });
  });
});
