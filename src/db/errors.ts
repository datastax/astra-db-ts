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

import { DataAPIError } from '@/src/documents';

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
   * The keyspace where the collection is not found.
   *
   * This is now a deprecated alias for the strictly equivalent {@link CollectionNotFoundError.keyspace}, and will be removed
   * in an upcoming major version.
   *
   * @deprecated - Prefer {@link CollectionNotFoundError.keyspace} instead.
   */
  public readonly namespace: string;

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
    this.keyspace = this.namespace = keyspace;
    this.collectionName = collectionName;
    this.name = 'CollectionNotFoundError';
  }
}

/**
 * An exception thrown when an operation that expects a collection not to exist is attempted on a collection that
 * already exists.
 *
 * @field keyspace - The keyspace where the collection already exists
 * @field collectionName - The name of the collection that already exists
 *
 * @public
 */
export class CollectionAlreadyExistsError extends DataAPIError {
  /**
   * The keyspace where the collection already exists
   */
  public readonly keyspace: string;

  /**
   * The keyspace where the collection already exists
   *
   * This is now a deprecated alias for the strictly equivalent {@link CollectionAlreadyExistsError.keyspace}, and will be removed
   * in an upcoming major version.
   *
   * @deprecated - Prefer {@link CollectionAlreadyExistsError.keyspace} instead.
   */
  public readonly namespace: string;

  /**
   * The name of the collection that already exists
   */
  public readonly collectionName: string;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(keyspace: string, collectionName: string) {
    super(`Collection '${keyspace}.${collectionName}' already exists`);
    this.keyspace = this.namespace = keyspace;
    this.collectionName = collectionName;
    this.name = 'CollectionAlreadyExistsError';
  }
}