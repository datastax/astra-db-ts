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

import { DatabaseAction, DatabaseCloudProvider, DatabaseStatus, DatabaseTier } from '@/src/client/types';

/**
 * Represents the complete information about a database.
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
   * Creation time in ISO RFC3339 format
   */
  creationTime?: string,
  /**
   * Termination time in ISO RFC3339 format
   */
  terminationTime?: string,
  /**
   * The current status of the database.
   */
  status: DatabaseStatus,
  /**
   * Contains the information about how much storage space a cluster has available
   */
  storage?: DatabaseStorageInfo,
  /**
   * The available actions that can be performed on the database
   */
  availableActions?: DatabaseAction[],
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
}

/**
 * The user-provided information describing a database
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
  user: string,
  /**
   * The password to connect to the database.
   */
  password: string,
  /**
   * Additional keyspace names in database.
   */
  additionalKeyspaces?: string[],
  /**
   * Type of the serverless database, currently only supported value is “vector”. "vector" creates a cassandra
   * database with vector support. Field not being inputted creates default serverless database.
   */
  dbType?: 'vector',
}

/**
 * Contains the information about how much storage space a cluster has available.
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
