// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Db } from '@/src/data-api';
import { assertTestsEnabled, DEFAULT_COLLECTION_NAME, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.options', () => {
  let db: Db;

  before(async function () {
    [, db] = await initTestObjects(this);
  });

  it('lists its own options', async () => {
    const coll = db.collection(DEFAULT_COLLECTION_NAME);
    const res = await coll.options();
    assert.deepStrictEqual(res, { vector: { dimension: 5, metric: 'cosine' } });
  });

  it('[long] lists its own empty options', async function () {
    assertTestsEnabled(this, 'LONG');
    const coll = await db.createCollection('test_db_collection_empty_opts');
    const res = await coll.options();
    assert.deepStrictEqual(res, {});
    await db.dropCollection('test_db_collection_empty_opts')
  });

  it('throws an error when collection not found', async () => {
    const coll = db.collection('nonexistent_collection');
    await assert.rejects(coll.options(), /Collection 'nonexistent_collection' not found/);
  });
});
