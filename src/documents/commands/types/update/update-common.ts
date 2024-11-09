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
 * Represents the set of fields that are guaranteed to be present in the result of some generic `update` command using
 * the Data API
 *
 * @field matchedCount - The number of records that matched the filter.
 * @field modifiedCount - The number of records that were actually modified.
 *
 * @public
 */
export interface GuaranteedUpdateResult<N extends number> {
  /**
   * The number of records that matched the filter.
   */
  matchedCount: N,
  /**
   * The number of records that were actually modified.
   */
  modifiedCount: N,
}

/**
 * Represents the set of fields that are present in the result of some generic `update` command using the Data API when
 * the `upsert` option is true, and an upsert occurred.
 *
 * @field upsertedId - The identifier of the upserted record.
 * @field upsertedCount - The number of records that were upserted.
 *
 * @public
 */
export interface UpsertedUpdateResult<ID> {
  /**
   * The identifier of the upserted record.
   */
  upsertedId: ID,
  /**
   * The number of records that were upserted.
   */
  upsertedCount: 1,
}

/**
 * Represents the set of fields that are present in the result of some generic `update` command using the Data API where
 * no upsert occurred.
 *
 * @field upsertedCount - The number of records that were upserted.
 * @field upsertedId - This field is never present.
 *
 * @public
 */
export interface NoUpsertUpdateResult {
  /**
   * The number of records that were upserted. This will always be undefined, since none occurred.
   */
  upsertedCount: 0;
  /**
   * This field is never present.
   */
  upsertedId?: never;
}

/**
 * Represents the result of a generic `update` command using the Data API.
 *
 * @example
 * ```typescript
 * const result = await collection.updateOne({
 *   _id: 'abc'
 * }, {
 *   $set: { name: 'John' }
 * }, {
 *   upsert: true
 * });
 *
 * if (result.upsertedCount) {
 *   console.log(`Record with identifier ${JSON.stringify(result.upsertedId)} was upserted`);
 * }
 * ```
 *
 * @field matchedCount - The number of records that matched the filter.
 * @field modifiedCount - The number of records that were actually modified.
 * @field upsertedCount - The number of records that were upserted.
 * @field upsertedId - The identifier of the upserted record if `upsertedCount > 0`.
 *
 * @public
 */
export type GenericUpdateResult<ID, N extends number> =
  | (GuaranteedUpdateResult<N> & UpsertedUpdateResult<ID>)
  | (GuaranteedUpdateResult<N> & NoUpsertUpdateResult)
