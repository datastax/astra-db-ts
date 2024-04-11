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

import { DatabaseAction, DatabaseCloudProvider, DatabaseStatus, DatabaseTier } from '@/src/devops/types';

/**
 * Represents the complete information about a database.
 *
 * @public
 */
export interface FullDatabaseInfo {
  /**
   * The id of the database
   */
  id: string,
  /**
   * The id of the organization that owns the database
   */
  orgId: string,
  /**
   * The id of the owner of the database
   */
  ownerId: string,
  /**
   * The user-provided information describing a database
   */
  info: DatabaseInfo,
  /**
   * Creation time, in ISO RFC3339 format
   */
  creationTime?: string,
  /**
   * The last time the database was used, in ISO RFC3339 format
   */
  lastUsageTime?: string,
  /**
   * The termination time, in ISO RFC3339 format, if the database was terminated
   */
  terminationTime?: string,
  /**
   * The current status of the database.
   */
  status: DatabaseStatus,
  /**
   * The observed status of the database.
   */
  observedStatus: DatabaseStatus,
  /**
   * Contains the information about how much storage space a cluster has available
   */
  storage?: DatabaseStorageInfo,
  /**
   * The available actions that can be performed on the database
   */
  availableActions?: DatabaseAction[],
  /**
   * The cost information for the database
   */
  cost?: CostInfo,
  /**
   * Message to the user about the cluster
   */
  message?: string,
  /**
   * Grafana URL for the database
   */
  grafanaUrl?: string,
  /**
   * CQLSH URL for the database
   */
  cqlshUrl?: string,
  /**
   * GraphQL URL for the database
   */
  graphqlUrl?: string,
  /**
   * REST URL for the database
   */
  dataEndpointUrl?: string,
  /**
   * Basic metrics information about the database
   */
  metrics?: DbMetricsInfo,
}

/**
 * The user-provided information describing a database
 *
 * @public
 */
export interface DatabaseInfo {
  /**
   * Name of the database--user friendly identifier
   */
  name: string,
  /**
   * Keyspace (aka namespace) name in database. If not passed, keyspace is created with name "default_keyspace"
   */
  keyspace?: string,
  /**
   * Cloud provider where the database lives
   */
  cloudProvider?: DatabaseCloudProvider,
  /**
   * Tier defines the compute power (vertical scaling) for the database, developer gcp is the free tier.
   */
  tier: DatabaseTier,
  /**
   * The amount of space available (horizontal scaling) for the database. For free tier the max CU's is 1, and 100
   * for CXX/DXX the max is 12 on startup.
   */
  capacityUnits: number,
  /**
   * The cloud region where the database is located.
   */
  region: string,
  /**
   * The user to connect to the database.
   */
  user?: string,
  /**
   * The password to connect to the database.
   */
  password?: string,
  /**
   * Additional keyspace names in database.
   */
  additionalKeyspaces?: string[],
  /**
   * All keyspace names in database.
   */
  keyspaces?: string[],
  /**
   * Type of the serverless database, currently only supported value is “vector”. "vector" creates a cassandra
   * database with vector support. Field not being inputted creates default serverless database.
   */
  dbType?: 'vector',
  /**
   * The datacenters for the database
   */
  datacenters?: DatacenterInfo[],
}

/**
 * Contains the information about how much storage space a cluster has available.
 *
 * @public
 */
export interface DatabaseStorageInfo {
  /**
   * Node count for the cluster.
   */
  nodeCount: number,
  /**
   * Number of nodes storing a piece of data
   */
  replicationFactor: number,
  /**
   * Total storage of the cluster in GB
   */
  totalStorage: number,
  /**
   * Used storage of the cluster in GB
   */
  usedStorage?: number,
}

/**
 * Information about a datacenter.
 *
 * @public
 */
export interface DatacenterInfo {
  /**
   * The number of capacity units for the datacenter.
   */
  capacityUnits: number,
  /**
   * The cloud provider where the datacenter is located.
   */
  cloudProvider: DatabaseCloudProvider,
  /**
   * The date the datacenter was created in ISO RFC3339 format.
   */
  dateCreated: string,
  /**
   * The id of the datacenter.
   */
  id: string,
  /**
   * Whether the datacenter is the primary datacenter.
   */
  isPrimary: boolean,
  /**
   * The name of the datacenter.
   */
  name: string,
  /**
   * The region where the datacenter is located.
   */
  region: string,
  /**
   * The region classification of the datacenter.
   */
  regionClassification: string,
  /**
   * The region zone of the datacenter.
   */
  regionZone: string,
  /**
   * The internal URL for the secure bundle.
   */
  secureBundleUrl: string,
  /**
   * The status of the datacenter (might be an empty string)
   */
  status: string,
  /**
   * The tier of the datacenter.
   */
  tier: DatabaseTier,
}

/**
 * Information about the running cost of the database.
 *
 * @public
 */
export interface CostInfo {
  /**
   * Regular cost per day in cents
   */
  costPerDayCents: number,
  /**
   * Cost per day for multi-region in cents
   */
  costPerDayMRCents: number,
  /**
   * Cost per day in cents while the database is parked
   */
  costPerDayParkedCents: number,
  /**
   * Cost per hour in cents
   */
  costPerHourCents: number,
  /**
   * Cost per hour for multi-region in cents
   */
  costPerHourMRCents: number,
  /**
   * Cost per hour in cents while the database is parked
   */
  costPerHourParkedCents: number,
  /**
   * Cost per minute in cents
   */
  costPerMinCents: number,
  /**
   * Cost per minute for multi-region in cents
   */
  costPerMinMRCents: number,
  /**
   * Cost per minute in cents while the database is parked
   */
  costPerMinParkedCents: number,
  /**
   * Cost per month in cents
   */
  costPerMonthCents: number,
  /**
   * Cost per month for multi-region in cents
   */
  costPerMonthMRCents: number,
  /**
   * Cost per month in cents while the database is parked
   */
  costPerMonthParkedCents: number,
  /**
   * Cost per GB of network transfer in cents
   */
  costPerNetworkGbCents: number,
  /**
   * Cost per GB read in cents
   */
  costPerReadGbCents: number,
  /**
   * Cost per GB written in cents
   */
  costPerWrittenGbCents: number,
}

/**
 * Basic metrics information about a database.
 *
 * @public
 */
export interface DbMetricsInfo {
  /**
   * The number of errors that have occurred in the database.
   */
  errorsTotalCount: number,
  /**
   * The number of live data bytes in the database.
   */
  liveDataSizeBytes: number,
  /**
   * The number of read requests that have occurred in the database.
   */
  readRequestsTotalCount: number,
  /**
   * The number of write requests that have occurred in the database.
   */
  writeRequestsTotalCount: number
}
