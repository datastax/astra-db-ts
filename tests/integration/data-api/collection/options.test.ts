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
import { testClient } from '@/tests/fixtures';
import assert from 'assert';
import { randAlphaNumeric } from '@ngneat/falso';

describe('integration.data-api.collection.options', () => {
  let db: Db;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }
    [, db] = await testClient.new();
  });

  it('lists its own options', async () => {
    const suffix = randAlphaNumeric({ length: 4 }).join("");
    const coll = await db.createCollection(`test_db_collection_${suffix}`, { vector: { dimension: 123, metric: 'cosine' } });
    const res = await coll.options();
    assert.deepStrictEqual(res, { vector: { dimension: 123, metric: 'cosine' }});
    await db.dropCollection(`test_db_collection_${suffix}`)
  });

  it('lists its own empty options', async () => {
    const suffix = randAlphaNumeric({ length: 4 }).join("");
    const coll = await db.createCollection(`test_db_collection_${suffix}`);
    const res = await coll.options();
    assert.deepStrictEqual(res, {});
    await db.dropCollection(`test_db_collection_${suffix}`)
  });
});
