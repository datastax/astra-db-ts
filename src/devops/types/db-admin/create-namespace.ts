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

import { AdminBlockingOptions } from '@/src/devops/types';

/**
 * Represents the common options for creating a namespace through the `astra-db-ts` client.
 *
 * See {@link AdminBlockingOptions} for more options about blocking behavior.
 *
 * If `updateDbNamespace` is set to true, the underlying `Db` instance used to create the `DbAdmin` will have its
 * current working namespace set to the newly created namespace immediately (even if the namespace isn't technically
 * yet created).
 *
 * @example
 * ```typescript
 * // If using non-astra, this may be a common idiom:
 * const client = new DataAPIClient({ environment: 'dse' });
 * const db = client.db('<endpoint>', { token: '<token>' });
 *
 * // Will internally call `db.useNamespace('new_namespace')`
 * await db.admin().createNamespace('new_namespace', {
 *   updateDbNamespace: true,
 * });
 *
 * // Creates collection in namespace `new_namespace` by default now
 * const coll = db.createCollection('my_coll');
 * ```
 *
 * @public
 */
export type CreateNamespaceOptions = AdminBlockingOptions & { updateDbNamespace?: boolean };
