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

import type { ObjectId, UUID } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * An interface which allows you to extend the types of {@link SomeId} to include your own custom types via declaration merging.
 *
 * > **⚠️Warning:** This is an advanced feature, and should only be used if you really need to use a type for the `_id` field which _isn't_ present in {@link SomeId} for whatever reason.
 *
 * To use this, you may merge the `SomeIdTypes` interface into your own project to specify additional allowed types for document IDs.
 * - This is especially useful if your system uses custom scalar representations (e.g. branded types or custom datatypes) that are not part of the default set.
 *
 * The field may be called anything except for `baseTypes`, as that is reserved for the default types.
 *
 * > **✏️Note:** This is a global declaration merging, so you should only do this once in your project.
 *
 * ---
 *
 * ##### Examples
 *
 * In this example after declaration merging, the {@link SomeId} will now also accept `{ $uuid: string }` and `BigNumber` as valid values for `_id`.
 *
 * @example
 * ```ts
 * import { BigNumber, SomeId } from '@datastax/astra-db-ts';
 *
 * declare module '@datastax/astra-db-ts' {
 *   interface SomeIdTypes {
 *     myTypes: { $uuid: string } | BigNumber,
 *   }
 * }
 *
 * const id1: SomeId = { $uuid: '123e4567-e89b-12d3-a456-426614174000' }; // OK
 * const id2: SomeId = BigNumber(123456789); // OK
 * const id3: SomeId = { $car: 123 }; // Type Error
 * ```
 *
 * In this example, {@link SomeId} will be set to `any`.
 *
 * @example
 * ```ts
 * import { SomeId } from '@datastax/astra-db-ts';
 *
 * declare module '@datastax/astra-db-ts' {
 *   interface SomeIdTypes {
 *     myTypes: any,
 *   }
 * }
 *
 * const id1: SomeId = { $uuid: '123e4567-e89b-12d3-a456-426614174000' }; // OK
 * const id2: SomeId = BigNumber(123456789); // OK
 * const id3: SomeId = { $car: 123 }; // OK
 * ```
 *
 * @see SomeId
 *
 * @public
 */
export interface SomeIdTypes {
  baseTypes: string | number | bigint | boolean | Date | UUID | ObjectId | null;
}

/**
 * ##### Overview
 *
 * Represents all possible types for a document ID, including any JSON scalar types, `Date`, `UUID`, and `ObjectId`.
 *
 * > **⚠️Warning:** The `_id` *can* be set to null `null`.
 * >
 * > Setting `_id: null` doesn't mean "auto-generate an ID" like it may in some other databases; it quite literally means "set the id to be `null`".
 *
 * It's heavily recommended to properly type this in your Schema, so you know what to expect for your `_id` field.
 *
 * > **💡Tip:** You may mitigate this concern on an untyped collections by using a type such as—substituting `string` for your desired id type—`{ _id: string } & SomeDoc`, which would allow the collection to remain untyped while still statically enforcing the `_id` type.
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
 * console.log(result.insertedId.toLowerCase()); // no issue; _id is string
 * ```
 *
 * @example
 * ```ts
 * const result = await db.collection<{ _id: string } & SomeDoc>('users').insertOne({
 *   name: 'John',
 * });
 *
 * console.log(result.insertedId.toLowerCase()); // also okay; _id is string
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
 * ---
 *
 * ##### The default ID
 *
 * By default, if no `_id` field is provided in an inserted document, it will be automatically generated and set as a string UUID (not an actual {@link UUID} type).
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
 *
 * ---
 *
 * ##### Expanding {@link SomeId}
 *
 * In case you need to expand the enumeration of valid types for `_id`, you can do so by expanding the {@link SomeIdTypes} interface via declaration merging.
 *
 * > **⚠️Warning:** This is an advanced feature, and should only be used if you really need to use a type for the `_id` field which _isn't_ present in {@link SomeId} for whatever reason.
 *
 * See {@link SomeIdTypes} for more information.
 *
 * @public
 */
export type SomeId = SomeIdTypes[keyof SomeIdTypes];

/**
 * Allows the given type to include an `_id` or not, even if it's not declared in the type
 *
 * @public
 */
export type MaybeId<T> = NoId<T> & { _id?: IdOf<T> }

/**
 * Includes an `_id` in the given type, even if it's not declared in the type
 *
 * @public
 */
export type WithId<T> = T & { _id: IdOf<T> }

/**
 * Represents a document as it's returned by the database by default.
 *
 * @public
 */
export type FoundDoc<Doc> = { _id: IdOf<Doc> } & NoId<Omit<Doc, '$vector' | '$vectorize'>>;

/**
 * Represents a doc that doesn't have an `_id`
 *
 * @public
 */
export type NoId<Doc> = Omit<Doc, '_id'>

/**
 * Represents a flattened version of the given type. Only goes one level deep.
 *
 * @public
 */
export type Flatten<Type> = Type extends (infer Item)[]
  ? Item
  : Type

/**
 * Extracts the `_id` type from a given schema, or defaults to `SomeId` if uninferable
 *
 * @public
 */
export type IdOf<Doc> =
  Doc extends { _id?: infer Id extends SomeId }
    ? Id
    : SomeId
