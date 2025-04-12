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

import type { GenericInsertOneOptions, IdOf } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * The options for an `insertOne` command on a {@link Collection}.
 *
 * @example
 * ```ts
 * const result = await collection.insertOne({
 *   name: 'John',
 *   age: 30,
 * }, {
 *   timeout: 10000,
 * });
 * ```
 *
 * @see Collection.insertOne
 * @see CollectionInsertOneResult
 *
 * @public
 */
export type CollectionInsertOneOptions = GenericInsertOneOptions;

/**
 * ##### Overview
 *
 * Represents the result of an `insertOne` command on a {@link Collection}.
 *
 * @example
 * ```ts
 * const result = await collection.insertOne({
 *   name: 'John',
 *   age: 30,
 * });
 *
 * console.log(result.insertedId);
 * ```
 *
 * ---
 *
 * ##### The `_id` type
 *
 * The type of the `_id` field is inferred from the {@link Collection}'s type, if it is present.
 *
 * If the collection is "untyped", or no `_id` field is present in its type, then it will default to {@link SomeId}, which is a union type covering all possible types for a document ID.
 *
 * You may mitigate this concern on an untyped collection by using a type such as `{ _id: string } & SomeDoc` which would allow the collection to remain untyped while still statically enforcing the `_id` type.
 *
 * @example
 * ```ts
 * interface User {
 *   _id: string,
 *   name: string,
 * }
 *
 * const result = await db.collection<User>('users').insertOne({
 *   name: 'John',
 * });
 *
 * console.log(result.insertedId.toLowerCase()); // no issue; _id is known to be string
 * ```
 *
 * @example
 * ```ts
 * const result = await db.collection<{ _id: string } & SomeDoc>('users').insertOne({
 *   name: 'John',
 * });
 *
 * console.log(result.insertedId.toLowerCase()); // also okay; _id is known to be string
 * ```
 *
 * @example
 * ```ts
 * const result = await db.collection('users').insertOne({
 *   name: 'John',
 * });
 *
 * console.log(result.insertedId.toLowerCase()); // type error; _id may not be string
 * ```
 *
 * @see Collection.insertOne
 * @see CollectionInsertOneOptions
 *
 * @public
 */
export interface CollectionInsertOneResult<RSchema> {
  /**
   * ##### Overview
   *
   * The ID of the inserted document—If no ID is provided when inserting the document, one will be automatically generated on your behalf.
   *
   * **Disclaimer: It is the user's responsibility to ensure that the ID type accommodates all possible variations—including auto-generated IDs and any user-provided ones.**
   *
   * @example
   * ```ts
   * const result = await collection.insertOne({
   *   _id: 123,
   *   name: 'John',
   * });
   * console.log(result.insertedId); // 123
   * ```
   *
   * @example
   * ```ts
   * const result = await collection.insertOne({
   *   name: 'John',
   * });
   * console.log(result.insertedId); // '123e4567-e89b-12d3-a456-426614174000'
   * ```
   *
   * ---
   *
   * ##### The default ID
   *
   * By default, if no `_id` field is provided in the inserted document, it will be automatically generated and set as a string UUID (not an actual {@link UUID} type).
   *
   * You can modify this behavior by changing the {@link CollectionDefinition.defaultId} type when creating the collection; this allows it to generate a {@link UUID} or {@link ObjectId} instead of a string UUID.
   *
   * See {@link CollectionDefaultIdOptions.type} for the exact types available.
   *
   * @example
   * ```ts
   * import { UUID } from '@datastax/astra-db-ts';
   *
   * const collection = db.collection('users', {
   *   defaultId: { type: 'uuid' },
   * });
   *
   * const result = await collection.insertOne({
   *   name: 'John',
   * });
   *
   * console.log(result.insertedId); // UUID('123e4567-e89b-12d3-a456-426614174000')
   * ```
   */
  insertedId: IdOf<RSchema>,
}
