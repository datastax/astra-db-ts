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
import { EPHEMERAL_COLLECTION_NAME, testClient } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.drop', () => {
  let db: Db;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }
    [, db] = await testClient.new();
  });

  it('[long] drops itself', async () => {
    const collection = await db.createCollection(EPHEMERAL_COLLECTION_NAME);

    const res = await collection.drop();
    assert.strictEqual(res, true);

    const collections = await db.listCollections();
    assert.strictEqual(collections.map(c => c.name).includes(EPHEMERAL_COLLECTION_NAME), false);
  });
});
