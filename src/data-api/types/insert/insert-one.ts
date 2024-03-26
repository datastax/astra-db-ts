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

import type { IdOf, BaseOptions } from '@/src/data-api/types';

/** @internal */
export interface InsertOneCommand {
  insertOne: {
    document: object,
  }
}

/**
 * Options for the insertOne command.
 *
 * @field vector - The vector to use for the document.
 *
 * @see Collection.insertOne
 */
export interface InsertOneOptions extends BaseOptions {
  /**
   * An optional vector to use for the document, if using a vector-enabled collection.
   *
   * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field on the
   * document itself. The two are interchangeable, but mutually exclusive.
   *
   * **NB. Setting this field will cause a shallow copy of the document to be made.** If performance is a concern, it
   * is recommended to directly set the `$vector` field on the document itself.
   *
   * If the document already has a `$vector` field, and this is set, the `$vector` field will be overwritten. It is
   * up to the user to ensure that both fields are not set at once.
   */
  vector?: number[],
}

/**
 * Represents the result of an insertOne command.
 *
 * @field insertedId - The ID of the inserted document.
 *
 * @see Collection.insertOne
 */
export interface InsertOneResult<Schema> {
  /**
   * The ID of the inserted document (this will be an autogenerated ID if one was not provided).
   *
   * Note that it is up to the user that the ID covers all possible types of IDs that the collection may have,
   * keeping in mind the type of the auto-generated IDs, as well as any the user may provide.
   */
  insertedId: IdOf<Schema>,
}
