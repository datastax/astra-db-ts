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

/**
 * Allows you to override the keyspace to use for some db operation. If not specified,
 * the db operation will use either the keyspace provided when creating the Db instance, the keyspace
 * provided when creating the DataAPIClient instance, or the default keyspace `'default_keyspace'`.
 * (in that order)
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('AstraCS:...');
 *
 * // Using 'default_keyspace' as the keyspace
 * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 *
 * // Using 'my_keyspace' as the keyspace
 * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
 *   keyspace: 'my_keyspace',
 * });
 *
 * // Finds 'my_collection' in 'default_keyspace'
 * const coll1 = db1.collections('my_collection');
 *
 * // Finds 'my_collection' in 'my_keyspace'
 * const coll2 = db1.collections('my_collection', {
 *   keyspace: 'my_keyspace',
 * });
 * ```
 *
 * @field keyspace - The keyspace to use for the db operation.
 *
 * @public
 */
export interface WithKeyspace {
  /**
   * The keyspace to use for the operation.
   */
  keyspace?: string;
}

/**
 * @internal
 */
export interface WithNullableKeyspace {
  keyspace?: string | null;
}
