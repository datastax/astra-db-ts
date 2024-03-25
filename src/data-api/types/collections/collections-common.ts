// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { SomeDoc } from '@/src/data-api';
import { ToDotNotation } from '@/src/data-api/types/dot-notation';

/**
 * Represents the options for the vector search.
 *
 * **If not specified, the collection will not support vector search.**
 *
 * @field dimension - The dimension of the vectors.
 * @field metric - The similarity metric to use for the vector search.
 * @field service - Options related to the vectorization pipeline, to specify an embedding service.
 */
export interface VectorOptions {
  /**
   * The dimension of the vectors stored in the collection.
   */
  dimension: number;
  /**
   * The similarity metric to use for the vector search.
   *
   * See [intro to vector databases](https://docs.datastax.com/en/astra/astra-db-vector/get-started/concepts.html#metrics) for more details.
   */
  metric: 'cosine' | 'euclidean' | 'dot_product';
}

/**
 * Represents the options for the indexing.
 *
 * **Only one of `allow` or `deny` can be specified.**
 *
 * See [indexing](https://docs.datastax.com/en/astra/astra-db-vector/api-reference/data-api-commands.html#advanced-feature-indexing-clause-on-createcollection) for more details.
 *
 * @example
 * ```typescript
 * const collection1 = await db.createCollection('my-collection', {
 *   indexing: {
 *     allow: ['name', 'age'],
 *   },
 * });
 *
 * const collection2 = await db.createCollection('my-collection', {
 *   indexing: {
 *     deny: ['*'],
 *   },
 * });
 * ```
 *
 * @field allow - The fields to index.
 * @field deny - The fields to not index.
 */
export type IndexingOptions<Schema extends SomeDoc> =
  | { allow: (keyof ToDotNotation<Schema>)[] | ['*'], deny?: never }
  | { deny: (keyof ToDotNotation<Schema>)[] | ['*'], allow?: never }

/**
 * Represents the options for the default ID.
 *
 * **If `type` is not specified, the default ID will be a string UUID.**
 *
 * @field type - The type of the default ID.
 */
export interface DefaultIdOptions {
  /**
   * The type of the default ID that the API should generate if no ID is provided in the inserted document.
   *
   * **If not specified, the default ID will be a string UUID.**
   *
   * | Type       | Description    | Example                                            |
   * |------------|----------------|----------------------------------------------------|
   * | `uuid`     | A UUID v4.     | `new UUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')` |
   * | `uuidv6`   | A UUID v6.     | `new UUID('6f752f1a-6b6d-4f3e-8e1e-2e167e3b5f3d')` |
   * | `uuidv7`   | A UUID v7.     | `new UUID('018e75ff-a07b-7b08-bb91-aa566c5abaa6')` |
   * | `objectId` | An ObjectID.   | `new ObjectId('507f1f77bcf86cd799439011')`         |
   * | default    | A string UUID. | `'f47ac10b-58cc-4372-a567-0e02b2c3d479'`           |
   *
   * @example
   * ```typescript
   * const collection1 = await db.createCollection('my-collection');
   *
   * // { name: 'Jessica', _id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }
   * await collection1.insertOne({ name: 'Jessica' });
   *
   * const collection2 = await db.createCollection('my-collection', {
   *   defaultId: { type: 'uuidv6' },
   * });
   *
   * // { name: 'Allman', _id: UUID('6f752f1a-6b6d-6f3e-8e1e-2e167e3b5f3d') }
   * await collection2.insertOne({ name: 'Allman' });
   *
   * const collection3 = await db.createCollection('my-collection', {
   *   defaultId: { type: 'objectId' },
   * });
   *
   * // { name: 'Brothers', _id: ObjectId('507f1f77bcf86cd799439011') }
   * await collection3.insertOne({ name: 'Brothers' });
   * ```
   */
  type: 'uuid' | 'uuidv6' | 'uuidv7' | 'objectId';
}

/**
 * Allows you to override the namespace (aka keyspace) to use for some db operation. If not specified,
 * the db operation will use either the namespace provided when creating the Db instance, the namespace
 * provided when creating the DataApiClient instance, or the default namespace `'default_keyspace'`.
 * (in that order)
 *
 * @example
 * ```typescript
 * const client = new DataApiClient('AstraCS:...');
 *
 * // Using 'default_keyspace' as the namespace
 * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 *
 * // Using 'my_namespace' as the namespace
 * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
 *   namespace: 'my_keyspace',
 * });
 *
 * // Finds 'my_collection' in 'default_keyspace'
 * const coll1 = db1.collection('my_collection');
 *
 * // Finds 'my_collection' in 'my_namespace'
 * const coll2 = db1.collection('my_collection', {
 *   namespace: 'my_namespace',
 * });
 * ```
 *
 * @field namespace - The namespace (aka keyspace) to use for the db operation.
 */
export interface WithNamespace {
  /**
   * The namespace (aka keyspace) to use for the db operation.
   */
  namespace?: string
}
