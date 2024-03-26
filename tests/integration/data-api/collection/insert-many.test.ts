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

import { Collection, InsertManyError, ObjectId, UUID } from '@/src/data-api';
import { testClient } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.insert-many', () => {
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

  it('should insertMany documents', async () => {
    const docs = [{ name: 'Inis Mona' }, { name: 'Helvetios' }, { name: 'Epona' }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);

    res.insertedIds.forEach((id) => {
      assert.ok(typeof id as any === 'string');
      assert.doesNotThrow(() => new UUID(<any>id));
    });
  });

  it('should insertMany documents with ids', async () => {
    const docs = [{ name: 'Inis Mona', _id: 1 }, { name: 'Helvetios', _id: 2 }, { name: 'Epona', _id: 3 }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds.sort((a, b) => <any>a - <any>b), docs.map((doc) => doc._id));
  });

  it('should insertMany documents with UUIDs', async () => {
    const docs = [{ name: 'Inis Mona', _id: UUID.v7() }, { name: 'Helvetios', _id: UUID.v7() }, { name: 'Epona', _id: UUID.v7() }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds.sort(), docs.map((doc) => doc._id.toString()));
  });

  it('should insertMany documents with ObjectIds', async () => {
    const docs = [{ name: 'Inis Mona', _id: new ObjectId() }, { name: 'Helvetios', _id: new ObjectId() }, { name: 'Epona', _id: new ObjectId() }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds.sort(), docs.map((doc) => doc._id.toString()));
  });

  it('should insertMany documents with a mix of ids', async () => {
    const docs = [{ name: 'Inis Mona', _id: new ObjectId() }, { name: 'Helvetios', _id: UUID.v4() }, { name: 'Epona' }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
  });

  it('should insertMany documents ordered', async () => {
    const docs = [{ name: 'Inis Mona', _id: 1 }, { name: 'Helvetios', _id: 2 }, { name: 'Epona', _id: 3 }];
    const res = await collection.insertMany(docs, { ordered: true });
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds, docs.map((doc) => doc._id));
  });

  it('should error out when one of the docs in insertMany is invalid with ordered true', async () => {
    const docs = Array.from({ length: 20 }, (_, i) => ({ _id: i }));
    docs[10] = docs[9];
    let error: any;
    try {
      await collection.insertMany(docs, { ordered: true });
      assert.fail('Should have thrown an error');
    } catch (e: any) {
      error = e;
    }
    assert.ok(error);
    assert.ok(error instanceof InsertManyError);
    assert.strictEqual(error.errorDescriptors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');
    assert.strictEqual(error.partialResult.insertedCount, 10);
    docs.slice(0, 10).forEach((doc, index) => {
      assert.strictEqual((error as InsertManyError).partialResult.insertedIds[index], doc._id);
    });
  });

  it('should error out when one of the docs in insertMany is invalid with ordered false', async () => {
    const docs = Array.from({ length: 20 }, (_, i) => ({ _id: i }));
    docs[10] = docs[9];
    let error: any;
    try {
      await collection.insertMany(docs, { ordered: false });
    } catch (e: any) {
      error = e;
    }
    assert.ok(error);
    assert.ok(error instanceof InsertManyError);
    assert.strictEqual(error.errorDescriptors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');
    assert.strictEqual(error.partialResult.insertedCount, 19);
    docs.slice(0, 9).concat(docs.slice(10)).forEach((doc) => {
      assert.ok((error as InsertManyError).partialResult.insertedIds.includes(doc._id!));
    });
  });
});
