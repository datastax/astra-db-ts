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
// noinspection DuplicatedCode

import type { IdOf, NoId, SomeDoc } from '@/src/data-api';
import type { Filter, UpdateFilter } from '@/src/data-api/types';
import { WithTimeout } from '@/src/common/types';

/**
 * Options for bulkWrite.
 *
 * The parameters depend on the `ordered` option. If `ordered` is `true`, the `parallel` option is not allowed.
 *
 * @see Collection.bulkWrite
 *
 * @public
 */
export type BulkWriteOptions =
  | BulkWriteOrderedOptions
  | BulkWriteUnorderedOptions;

/**
 * Options for insertMany when `ordered` is `true`.
 *
 * @field ordered - If `true`, the operations are executed in the order provided.
 *
 * @see Collection.bulkWrite
 *
 * @public
 */
export interface BulkWriteOrderedOptions extends WithTimeout {
  /**
   * If `true`, the operations are executed in the order provided. If an error occurs, the operation stops and the
   * remaining operations are not executed.
   */
  ordered: true,
}

/**
 * Options for insertMany when `ordered` is `false`.
 *
 * @field ordered - If `false` or unset, the documents are inserted in an arbitrary, parallelized order.
 * @field parallel - The number of concurrent requests to use.
 *
 * @see Collection.bulkWrite
 *
 * @public
 */
export interface BulkWriteUnorderedOptions extends WithTimeout {
  /**
   * If `false`, the operations are inserted in an arbitrary order. If an error occurs, the operation stops but the
   * remaining operations are still executed. This allows the operations to be parallelized for better performance.
   */
  ordered?: false,
  /**
   * The number of concurrent requests to use
   */
  concurrency?: number,
}

/**
 * Represents the result of a bulk write operation.
 *
 * @public
 */
export class BulkWriteResult<Schema extends SomeDoc> {
  constructor(
    /**
     * The number of documents deleted.
     */
    readonly deletedCount: number = 0,
    /**
     * The number of documents inserted.
     */
    readonly insertedCount: number = 0,
    /**
     * The number of documents matched by an update operation.
     */
    readonly matchedCount: number = 0,
    /**
     * The number of documents modified.
     */
    readonly modifiedCount: number = 0,
    /**
     * The number of documents upserted.
     */
    readonly upsertedCount: number = 0,
    /**
     * Upserted document generated ids. Sparse array, indexed by the position of the upserted operation in the bulk
     * write request.
     */
    readonly upsertedIds: Record<number, IdOf<Schema>> = {},
    private readonly _raw: object[] = [],
  ) {}

  /**
   * Returns the raw, internal result.
   *
   * @returns The raw, internal result.
   */
  getRawResponse(): Record<string, any>[] {
    return this._raw;
  }

  /**
   * Returns the upserted id at the given index.
   *
   * @param index - The index of the upserted id to retrieve.
   *
   * @returns The upserted id at the given index, or `undefined` if there is no upserted id at that index.
   */
  getUpsertedIdAt(index: number): IdOf<Schema> | undefined {
    return this.upsertedIds[index];
  }
}

/**
 * Represents *some* bulk write operation.
 *
 * Be careful not to pass in multiple operations in the same object.
 *
 * @public
 */
export type AnyBulkWriteOperation<TSchema extends SomeDoc> = {
  insertOne: InsertOneModel<TSchema>;
} | {
  replaceOne: ReplaceOneModel<TSchema>;
} | {
  updateOne: UpdateOneModel<TSchema>;
} | {
  updateMany: UpdateManyModel<TSchema>;
} | {
  deleteOne: DeleteOneModel<TSchema>;
} | {
  deleteMany: DeleteManyModel<TSchema>;
}

/**
 * Represents an insertOne operation that can be used in a bulk write operation.
 *
 * @field document - The document to insert.
 *
 * @public
 */
export interface InsertOneModel<TSchema extends SomeDoc> {
  /**
   * The document to insert.
   */
  document: TSchema,
}

/**
 * Represents a replaceOne operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the document to replace.
 * @field replacement - The replacement document, which contains no `_id` field.
 * @field upsert - If true, perform an insert if no documents match the filter.
 *
 * @public
 */
export interface ReplaceOneModel<TSchema extends SomeDoc> {
  /**
   * The filter to choose the document to replace.
   */
  filter: Filter<TSchema>,
  /**
   * The replacement document, which contains no `_id` field.
   */
  replacement: NoId<TSchema>,
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   *
   * @defaultValue false
   */
  upsert?: boolean,
}

/**
 * Represents an updateOne operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the document to update.
 * @field update - The update to apply to the document.
 * @field upsert - If true, perform an insert if no documents match the filter.
 *
 * @public
 */
export interface UpdateOneModel<TSchema extends SomeDoc> {
  /**
   * The filter to choose the document to update.
   */
  filter: Filter<TSchema>,
  /**
   * The update to apply to the document.
   */
  update: UpdateFilter<TSchema>,
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   *
   * @defaultValue false
   */
  upsert?: boolean,
}

/**
 * Represents an updateMany operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the documents to update.
 * @field update - The update to apply to the documents.
 * @field upsert - If true, perform an insert if no documents match the filter.
 *
 * @public
 */
export interface UpdateManyModel<TSchema extends SomeDoc> {
  /**
   * The filter to choose the documents to update.
   */
  filter: Filter<TSchema>,
  /**
   * The update to apply to the documents.
   */
  update: UpdateFilter<TSchema>,
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   *
   * @defaultValue false
   */
  upsert?: boolean,
}

/**
 * Represents a deleteOne operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the document to delete.
 *
 * @public
 */
export interface DeleteOneModel<TSchema extends SomeDoc> {
  /**
   * The filter to choose the document to delete.
   */
  filter: Filter<TSchema>,
}

/**
 * Represents a deleteMany operation that can be used in a bulk write operation.
 *
 * @public
 */
export interface DeleteManyModel<TSchema extends SomeDoc> {
  /**
   * The filter to choose the documents to delete.
   */
  filter: Filter<TSchema>,
}
