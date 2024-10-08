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

import { IdOf, SomeDoc } from '@/src/documents/collections/types';
import { WithTimeout } from '@/src/lib/types';

/** @internal */
export interface InsertManyCommand {
  insertMany: {
    documents: unknown[],
    options?: {
      returnDocumentResponses: true,
      ordered?: boolean,
    },
  }
}

/**
 * Options for insertMany.
 *
 * The parameters depend on the `ordered` option. If `ordered` is `true`, the `parallel` option is not allowed.
 *
 * @field ordered - If `true`, the docs are inserted sequentially; else, they're arbitrary inserted in parallel.
 * @field concurrency - The maximum number of concurrent requests to make at once.
 * @field chunkSize - The number of documents to upload per request. Defaults to 20.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export type InsertManyOptions =
  | InsertManyUnorderedOptions
  | InsertManyOrderedOptions;

/**
 * Options for insertMany when `ordered` is `true`.
 *
 * @field ordered - If `true`, the documents are inserted sequentially in the order provided.
 * @field chunkSize - The number of documents to upload per request. Defaults to 20.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export interface InsertManyOrderedOptions extends WithTimeout {
  /**
   * If `true`, the documents are inserted in the order provided. If an error occurs, the operation stops and the
   * remaining documents are not inserted.
   */
  ordered: true,
  /**
   * The number of documents to upload per request. Defaults to 20.
   *
   * If you have large documents, you may find it beneficial to reduce this number and increase concurrency to
   * improve throughput. Leave it unspecified (recommended) to use the system default.
   *
   * @defaultValue 20
   */
  chunkSize?: number,
  /**
   * A list of optional vectors to use for the documents, if using a vector-enabled collection.
   *
   * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field on the
   * documents themselves. The two are interchangeable, but mutually exclusive.
   *
   * The list may contain `null` or `undefined` values, which mark the corresponding document as not having a vector
   * (or the doc having its `$vector` field already set).
   *
   * **NB. Setting this field will cause a shallow copy of the documents to be made for non-null vectors.** If
   * performance is a concern, it is recommended to directly set the `$vector` field on the document itself.
   *
   * If any document already has a `$vector` field, and this is set, the `$vector` field will be overwritten. It is
   * up to the user to ensure that both fields are not set at once.
   *
   * @deprecated - Prefer to set the `$vector` fields in the docs directly
   */
  vectors?: (number[] | null | undefined)[],
  /**
   Akin to {@link InsertManyOrderedOptions.vectors}, but for `$vectorize`.
   *
   * @deprecated - Prefer to set the `$vectorize` fields in the docs directly
   */
  vectorize?: (string | null | undefined)[],
}

/**
 * Options for insertMany when `ordered` is `false`.
 *
 * @field ordered - If `false` or unset, the documents are inserted in an arbitrary, parallelized order.
 * @field concurrency - The maximum number of concurrent requests to make at once.
 * @field chunkSize - The number of documents to upload per request. Defaults to 20.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export interface InsertManyUnorderedOptions extends WithTimeout {
  /**
   * If `false`, the documents are inserted in an arbitrary order. If an error occurs, the operation does not stop
   * and the remaining documents are inserted. This allows the operation to be parallelized for better performance.
   */
  ordered?: false,
  /**
   * The maximum number of concurrent requests to make at once.
   */
  concurrency?: number,
  /**
   * The number of documents to upload per request. Defaults to 20.
   *
   * If you have large documents, you may find it beneficial to reduce this number and increase concurrency to
   * improve throughput. Leave it unspecified (recommended) to use the system default.
   *
   * @defaultValue 20
   */
  chunkSize?: number,
  /**
   * A list of optional vectors to use for the documents, if using a vector-enabled collection.
   *
   * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field on the
   * documents themselves. The two are interchangeable, but mutually exclusive.
   *
   * The list may contain `null` or `undefined` values, which mark the corresponding document as not having a vector
   * (or the doc having its `$vector` field already set).
   *
   * **NB. Setting this field will cause a shallow copy of the documents to be made for non-null vectors.** If
   * performance is a concern, it is recommended to directly set the `$vector` field on the document itself.
   *
   * If any document already has a `$vector` field, and this is set, the `$vector` field will be overwritten. It is
   * up to the user to ensure that both fields are not set at once.
   *
   * @deprecated - Prefer to set the `$vector` fields in the docs directly
   */
  vectors?: (number[] | null | undefined)[],
  /**
   * Akin to {@link InsertManyUnorderedOptions.vectors}, but for `$vectorize`.
   *
   * @deprecated - Prefer to set the `$vectorize` fields in the docs directly
   */
  vectorize?: (string | null | undefined)[],
}

/**
 * Represents the result of an insertMany command.
 *
 * @field insertedIds - The IDs of the inserted documents.
 * @field insertedCount - The number of inserted documents.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export interface InsertManyResult<Schema extends SomeDoc> {
  /**
   * The IDs of the inserted documents (including the autogenerated IDs).
   *
   * Note that it is up to the user that the IDs cover all possible types of IDs that the collection may have,
   * keeping in mind the type of the auto-generated IDs, as well as any the user may provide.
   */
  insertedIds: IdOf<Schema>[];
  /**
   * The number of inserted documents (equals `insertedIds.length`).
   */
  insertedCount: number;
}

export type InsertManyDocumentResponse<_T> = any;

// /**
//  * Represents the specific status and id for a document present in the `insertMany` command. Present when an
//  * {@link InsertManyError} is thrown.
//  *
//  * @see Collection.insertMany
//  * @see InsertManyError
//  *
//  * @public
//  */
// export interface InsertManyDocumentResponse<Schema extends SomeDoc> {
//   /**
//    * The exact value of the `_id` field of the document that was inserted, whether it be the value passed by the client,
//    * or a server generated ID.
//    */
//   _id: IdOf<Schema>,
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
