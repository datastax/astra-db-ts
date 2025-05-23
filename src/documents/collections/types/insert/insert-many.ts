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

import type { GenericInsertManyOptions, IdOf } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * The options for an `insertMany` command on a collection.
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
 * const result = await collection.insertMany([
 *   { name: 'John', age: 30 },
 *   { name: 'Jane', age: 25 },
 * ], {
 *   concurrency: 16, // ordered implicitly `false` if unset
 * });
 * ```
 *
 * ---
 *
 * ##### Datatypes
 *
 * See {@link Collection}'s documentation for information on the available datatypes for collections.
 *
 * @see Collection.insertMany
 * @see CollectionInsertManyResult
 *
 * @public
 */
export type CollectionInsertManyOptions = GenericInsertManyOptions;

/**
 * ##### Overview
 *
 * Represents the result of an `insertMany` command on a {@link Collection}.
 *
 * @example
 * ```ts
 * try {
 *   const result = await collection.insertMany([
 *     { name: 'John', age: 30 },
 *     { name: 'Jane', age: 25 },
 *   ]);
 *   console.log(result.insertedIds);
 * } catch (e) {
 *   if (e instanceof CollectionInsertManyError) {
 *     console.log(e.insertedIds())
 *     console.log(e.errors())
 *   }
 * }
 * ```
 *
 * ---
 *
 * ##### The `_id` fields
 *
 * The type of the `_id` fields are inferred from the {@link Collection}'s type, if it is present.
 *
 * > **⚠️Warning:** It is the user's responsibility to ensure that the ID type accommodates all possible variations—including auto-generated IDs and any user-provided ones.
 *
 * If the collection is "untyped", or no `_id` field is present in its type, then it will default to {@link SomeId}, which is a union type covering all possible types for a document ID.
 *
 * You may mitigate this concern on untyped collections by using a type such as `{ _id: string } & SomeDoc` which would allow the collection to remain generally untyped while still statically enforcing the `_id` type.
 *
 * > **💡Tip:** See the {@link SomeId} type for more information, and concrete examples, on this subject.
 *
 * ---
 *
 * ##### The default ID
 *
 * By default, if no `_id` fields are provided in any inserted document, it will be automatically generated and set as a string UUID (not an actual {@link UUID} type).
 *
 * You can modify this behavior by changing the {@link CollectionDefinition.defaultId} type when creating the collection; this allows it to generate a {@link UUID} or {@link ObjectId} instead of a string UUID.
 *
 * > **💡Tip:** See {@link SomeId} and {@link CollectionDefinition.defaultId} for more information, and concrete examples, on this subject.
 *
 * @see Collection.insertMany
 * @see CollectionInsertManyOptions
 *
 * @public
 */
export interface CollectionInsertManyResult<RSchema> {
  /**
   * The ID of the inserted documents. These may have been autogenerated if no `_id` was present in any of the inserted documents.
   *
   * See {@link CollectionInsertManyResult} for more information about the inserted id.
   */
  insertedIds: IdOf<RSchema>[],
  /**
   * The number of documents that were inserted into the collection.
   *
   * This is **always** equal to the length of the `insertedIds` array.
   */
  insertedCount: number,
}

// export type InsertManyDocumentResponse<_T> = any;
//
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
