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
 * Represents the options for creating a database on a non-Astra database (i.e. blocking options + namespace creation options).
 *
 * If no replication options are provided, it will default to `'SimpleStrategy'` with a replication factor of `1`.
 *
 * @public
 */
export type CreateNamespaceOptions = AdminBlockingOptions & { replication?: NamespaceReplicationOptions };

/**
 * Represents the replication options for a namespace.
 *
 * Two replication strategies are available:
 *
 * - SimpleStrategy: Use only for a single datacenter and one rack. If you ever intend more than one datacenter, use the `NetworkTopologyStrategy`.
 *
 * - NetworkTopologyStrategy: Highly recommended for most deployments because it is much easier to expand to multiple datacenters when required by future expansion.
 *
 * If no replication options are provided, it will default to `'SimpleStrategy'` with a replication factor of `1`.
 *
 * @example
 * ```typescript
 * await dbAdmin.createNamespace('my_namespace');
 *
 * await dbAdmin.createNamespace('my_namespace' {
 *   replication: {
 *     class: 'SimpleStrategy',
 *     replicatonFactor: 3,
 *   },
 * });
 *
 * await dbAdmin.createNamespace('my_namespace' {
 *   replication: {
 *     class: 'NetworkTopologyStrategy',
 *     datacenter1: 3,
 *     datacenter1: 2,
 *   },
 * });
 * ```
 *
 * See the [datastax docs](https://docs.datastax.com/en/cassandra-oss/3.0/cassandra/architecture/archDataDistributeReplication.html) for more info.
 *
 * @public
 */
export type NamespaceReplicationOptions = {
  class: 'SimpleStrategy',
  replicationFactor: number,
} | {
  class: 'NetworkTopologyStrategy',
  [datacenter: string]: number | 'NetworkTopologyStrategy',
}
