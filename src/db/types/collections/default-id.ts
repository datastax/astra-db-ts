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

/**
 * Represents the options for the default ID.
 *
 * **If `type` is not specified, the default ID will be a string UUID.**
 *
 * @field type - The type of the default ID.
 *
 * @public
 */
export interface CollectionDefaultIdOptions {
  /**
   * The type of the default ID that the API should generate if no ID is provided in the inserted document.
   *
   * **If not specified, the default ID will be a string UUID.**
   *
   * | Type       | Description    | Example                                            |
   * |------------|----------------|----------------------------------------------------|
   * | `uuid`     | A UUID v4.     | `new UUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')` |
   * | `uuidv6`   | A UUID v6.     | `new UUID('6f752f1a-6b6d-4f3e-8e1e-2e167e3b5f3d')` |
   * | `uuidv7`   | A UUID v7.     | `new UUID('018e75ff-a07b-7b08-bb91-aa566c5abaa6')` |
   * | `objectId` | An ObjectID.   | `new ObjectId('507f1f77bcf86cd799439011')`         |
   * | unset      | A string UUID. | `'f47ac10b-58cc-4372-a567-0e02b2c3d479'`           |
   *
   * @example
   * ```typescript
   * const collections = await db.createCollection('my-collections');
   *
   * // { name: 'Jessica', _id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }
   * await collections.insertOne({ name: 'Jessica' });
   *```
   *
   * @example
   * ```typescript
   * const collections = await db.createCollection('my-collections', {
   *   defaultId: { type: 'uuidv6' },
   * });
   *
   * // { name: 'Allman', _id: UUID('6f752f1a-6b6d-6f3e-8e1e-2e167e3b5f3d') }
   * await collections.insertOne({ name: 'Allman' });
   * ```
   *
   * @example
   * ```typescript
   * const collections = await db.createCollection('my-collections', {
   *   defaultId: { type: 'objectId' },
   * });
   *
   * // { name: 'Brothers', _id: ObjectId('507f1f77bcf86cd799439011') }
   * await collections.insertOne({ name: 'Brothers' });
   * ```
   *
   * @remarks Make sure you're keeping this all in mind if you're specifically typing your _id field.
   */
  type: 'uuid' | 'uuidv6' | 'uuidv7' | 'objectId';
}
