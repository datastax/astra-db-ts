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

import { DataAPIError } from '@/src/documents/errors';

/**
 * An exception thrown when certain operations are attempted on a collection that does not exist.
 *
 * @field keyspace - The keyspace that the collection was not found in
 * @field collectionName - The name of the collection that was not found
 *
 * @public
 */
export class CollectionNotFoundError extends DataAPIError {
  /**
   * The keyspace where the collection is not found.
   */
  public readonly keyspace: string;

  /**
   * The name of the collection that is not found.
   */
  public readonly collectionName: string;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(keyspace: string, collectionName: string) {
    super(`Collection '${keyspace}.${collectionName}' not found`);
    this.keyspace = keyspace;
    this.collectionName = collectionName;
    this.name = 'CollectionNotFoundError';
  }
}

/**
 * An exception thrown when certain operations are attempted in a {@link DataAPIEnvironment} that is not valid.
 *
 * @field currentEnvironment - The environment that was attempted to be used
 * @field expectedEnvironments - The environments that are valid for the operation
 */
export class InvalidEnvironmentError extends Error {
  /**
   * The environment that was attempted to be used.
   */
  public readonly currentEnvironment: string;

  /**
   * The environments that are valid for the operation.
   */
  public readonly expectedEnvironments: string[];

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(operation: string, currentEnvironment: string, expectedEnvironments: string[], extra = '') {
    super(`Invalid environment '${currentEnvironment}' for operation '${operation}' ${extra ? `(${extra})` : ''}; expected environment(s): ${expectedEnvironments.map(e => `'${e}'`).join(', ')}`);
    this.currentEnvironment = currentEnvironment;
    this.expectedEnvironments = expectedEnvironments;
    this.name = 'InvalidEnvironmentError';
  }
}
