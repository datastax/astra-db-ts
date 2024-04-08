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

import type { IdOf, SomeDoc } from '@/src/data-api';
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
 * @public
 */
export class BulkWriteResult<Schema extends SomeDoc> {
  constructor(
    readonly deletedCount: number = 0,
    readonly insertedCount: number = 0,
    readonly matchedCount: number = 0,
    readonly modifiedCount: number = 0,
    readonly upsertedCount: number = 0,
    readonly upsertedIds: Record<number, IdOf<Schema>> = {},
    private readonly _raw: object[] = [],
  ) {}

  getRawResponse(): Record<string, any>[] {
    return this._raw;
  }

  getUpsertedIdAt(index: number): IdOf<Schema> {
    return this.upsertedIds[index];
  }
}

/**
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
 * @public
 */
export interface InsertOneModel<TSchema extends SomeDoc> {
  document: TSchema;
}

/**
 * @public
 */
export interface ReplaceOneModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
  replacement: TSchema;
  upsert?: boolean;
}

/**
 * @public
 */
export interface UpdateOneModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
  update: UpdateFilter<TSchema>;
  upsert?: boolean;
}

/**
 * @public
 */
export interface UpdateManyModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
  update: UpdateFilter<TSchema>;
  upsert?: boolean;
}

/**
 * @public
 */
export interface DeleteOneModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
}

/**
 * @public
 */
export interface DeleteManyModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
}