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

import type { WithTimeout } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * The options for a generic `insertMany` command performed on the Data API.
 *
 * > **🚨Important:** The options depend on the `ordered` parameter. If `ordered` is `true`, then the `concurrency` option is not allowed.
 *
 * @example
 * ```ts
 * const result = await collection.insertMany([
 *   { name: 'John', age: 30 },
 *   { name: 'Jane', age: 25 },
 * ], {
 *   ordered: true,
 *   timeout: 60000,
 * });
 * ```
 *
 * @example
 * ```ts
 * const result = await table.insertMany([
 *   { id: uuid.v4(), name: 'John' },
 *   { id: uuid.v7(), name: 'Jane' },
 * ], {
 *   concurrency: 16, // ordered implicitly `false` if unset
 * });
 * ```
 *
 * @public
 */
export type GenericInsertManyOptions =
  | GenericInsertManyUnorderedOptions
  | GenericInsertManyOrderedOptions;

/**
 * ##### Overview
 *
 * The options for a generic `insertMany` command performed on the Data API when `ordered` is `true`.
 *
 * > **🚨Important:** The options depend on the `ordered` parameter. If `ordered` is `true`, then the `concurrency` option is not allowed.
 *
 * @example
 * ```ts
 * const result = await collection.insertMany([
 *   { name: 'John', age: 30 },
 *   { name: 'Jane', age: 25 },
 * ], {
 *   ordered: true,
 *   timeout: 60000,
 * });
 * ```
 *
 * @see GenericInsertManyOptions
 *
 * @public
 */
export interface GenericInsertManyOrderedOptions extends WithTimeout<'generalMethodTimeoutMs'> {
  /**
   * If `true`, the records are inserted in the order provided. If an error occurs, the operation stops and the
   * remaining records are not inserted.
   */
  ordered: true,
  /**
   * The number of records to upload per request. Defaults to 50.
   *
   * If you have large records, you may find it beneficial to reduce this number and increase concurrency to
   * improve throughput. Leave it unspecified (recommended) to use the system default.
   *
   * @defaultValue 50
   */
  chunkSize?: number,
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Set the `$vector` field in the docs directly.
   */
  vector?: 'ERROR: Set the `$vector` field in the docs directly',
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Set the `$vectorize` field in the docs directly.
   */
  vectorize?: 'ERROR: Set the `$vectorize` field in the docs directly',
}

/**
 * ##### Overview
 *
 * The options for a generic `insertMany` command performed on the Data API when `ordered` is `true`.
 *
 * > **🚨Important:** The options depend on the `ordered` parameter. If `ordered` is `true`, then the `concurrency` option is not allowed.
 *
 * @example
 * ```ts
 * const result = await table.insertMany([
 *   { id: uuid.v4(), name: 'John' },
 *   { id: uuid.v7(), name: 'Jane' },
 * ], {
 *   concurrency: 16, // ordered implicitly `false` if unset
 * });
 * ```
 *
 * @see GenericInsertManyOptions
 *
 * @public
 */
export interface GenericInsertManyUnorderedOptions extends WithTimeout<'generalMethodTimeoutMs'> {
  /**
   * If `false`, the records are inserted in an arbitrary order. If an error occurs, the operation does not stop
   * and the remaining records are inserted. This allows the operation to be parallelized for better performance.
   */
  ordered?: false,
  /**
   * The maximum number of concurrent requests to make at once.
   */
  concurrency?: number,
  /**
   * The number of records to upload per request. Defaults to 50.
   *
   * If you have large records, you may find it beneficial to reduce this number and increase concurrency to
   * improve throughput. Leave it unspecified (recommended) to use the system default.
   *
   * @defaultValue 50
   */
  chunkSize?: number,
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Set the `$vector` field in the docs directly.
   */
  vector?: 'ERROR: Set the `$vector` field in the docs directly',
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Set the `$vectorize` field in the docs directly.
   */
  vectorize?: 'ERROR: Set the `$vectorize` field in the docs directly',
}

/**
 * Shouldn't be used by the user directly.
 *
 * @internal
 */
export interface GenericInsertManyResult<ID> {
  insertedIds: ID[],
  insertedCount: number,
}

/**
 * Shouldn't be used by the user directly.
 *
 * @internal
 */
export type GenericInsertManyDocumentResponse<_T> = any;

// /**
//  * Represents the specific status and id for a document present in the `insertMany` command. Present when an
//  * {@link InsertManyError} is thrown.
//  *
//  * @see Collection.insertMany
//  * @see InsertManyError
//  *
//  * @public
//  */
// export interface GenericInsertManyDocumentResponse<ID> {
//   /**
//    * The exact value of the `_id` field of the document that was inserted, whether it be the value passed by the client,
//    * or a server generated ID.
//    */
//   _id: ID,
//   /**
//    * The processing status of the document
//    * - `OK`: The document was successfully processed, in which case the `error` field will be undefined for this object
//    * - `ERROR`: There was an error processing the document, in which case the `error` field will be present for this object
//    * - `SKIPPED`: The document was not processed because either the `insertMany` command was processing documents in order
//    * which means the processing fails at the first failure, or some other failure occurred before this document was
//    * processed. The `error` field will be undefined for this object.
//    */
//   status: 'OK' | 'ERROR' | 'SKIPPED',
//   /**
//    * The error which caused this document to fail insertion.
//    */
//   error?: DataAPIErrorDescriptor,
// }
