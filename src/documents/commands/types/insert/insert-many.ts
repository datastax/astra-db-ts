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

import { WithTimeout } from '@/src/lib/types';

export type GenericInsertManyOptions =
  | GenericInsertManyUnorderedOptions
  | GenericInsertManyOrderedOptions;

export interface GenericInsertManyOrderedOptions extends WithTimeout {
  ordered: true,
  chunkSize?: number,
}

export interface GenericInsertManyUnorderedOptions extends WithTimeout {
  ordered?: false,
  concurrency?: number,
  chunkSize?: number,
}

export interface GenericInsertManyResult<ID> {
  insertedIds: ID[];
  insertedCount: number;
}

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
