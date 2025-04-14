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
 * ##### Overview
 *
 * Represents the set of fields that are guaranteed to be present in the result of a generic `update*` command performed on the Data API.
 *
 * > **✏️Note:** Depending on whether the update operation is `updateOne` or `updateMany`, the `N` type parameter can be either `1` or `number`, respectively.
 *
 * @see GenericUpdateResult
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
 * ##### Overview
 *
 * Represents the set of fields that are present in the result of a generic `update*` command performed on the Data API, when:
 * - The `upsert` option is `true`, and
 * - An upsert occurred.
 *
 * @see GenericUpdateResult
 * @see NoUpsertUpdateResult
 *
 * @public
 */
export interface UpsertedUpdateResult<ID> {
  /**
   * The number of records that were upserted. Only one record can be upserted in an operation.
   */
  upsertedCount: 1,
  /**
   * The identifier of the upserted record.
   */
  upsertedId: ID,
}

/**
 * ##### Overview
 *
 * Represents the set of fields that are present in the result of a generic `update*` command performed on the Data API, when:
 * - The `upsert` option is `false`, _or_
 * - The `upsert` option is `true`, but no upsert occurred.
 *
 * @see GenericUpdateResult
 * @see UpsertedUpdateResult
 *
 * @public
 */
export interface NoUpsertUpdateResult {
  /**
   * The number of records that were upserted. This will always be 0, since none occurred.
   */
  upsertedCount: 0;
  /**
   * This field is never present.
   */
  upsertedId?: never;
}

/**
 * ##### Overview
 *
 * Represents the result of a generic `update*` command performed on the Data API.
 *
 * > **🚨Important:** The exact result type depends on the `upsertedCount` field of the result:
 * - If `upsertedCount` is `0`, the result will be of type {@link GuaranteedUpdateResult} & {@link NoUpsertUpdateResult}.
 * - If `upsertedCount` is `1`, the result will be of type {@link GuaranteedUpdateResult} & {@link UpsertedUpdateResult}.
 *
 *
 * @example
 * ```typescript
 * const result = await collection.updateOne(
 *   { _id: 'abc' },
 *   { $set: { name: 'John' } },
 *   { upsert: true },
 * );
 *
 * if (result.upsertedCount) {
 *   console.log(`Document with ID ${result.upsertedId} was upserted`);
 * }
 * ```
 *
 * @see CollectionUpdateOneResult
 * @see CollectionUpdateManyResult
 *
 * @public
 */
export type GenericUpdateResult<ID, N extends number> =
  | (GuaranteedUpdateResult<N> & UpsertedUpdateResult<ID>)
  | (GuaranteedUpdateResult<N> & NoUpsertUpdateResult)
