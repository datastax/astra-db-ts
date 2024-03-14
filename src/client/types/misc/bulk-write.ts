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

import { Filter, SomeDoc, UpdateFilter } from '@/src/client';
import { SomeId } from '@/src/client/types/common';

export type BulkWriteOptions =
  | BulkWriteOrderedOptions
  | BulkWriteUnorderedOptions;

/**
 * Options for insertMany when `ordered` is `true`.
 */
export interface BulkWriteOrderedOptions {
  /**
   * If `true`, the operations are executed in the order provided. If an error occurs, the operation stops and the
   * remaining operations are not executed.
   */
  ordered: true,
}

/**
 * Options for insertMany when `ordered` is `false`.
 */
export interface BulkWriteUnorderedOptions {
  /**
   * If `false`, the operations are inserted in an arbitrary order. If an error occurs, the operation stops but the
   * remaining operations are still executed. This allows the operations to be parallelized for better performance.
   */
  ordered?: false,
  /**
   * The number of concurrent requests to use
   */
  parallel?: number,
}


export class BulkWriteResult {
  constructor(
    readonly deletedCount: number = 0,
    readonly insertedCount: number = 0,
    readonly matchedCount: number = 0,
    readonly modifiedCount: number = 0,
    readonly upsertedCount: number = 0,
    readonly upsertedIds: Record<number, SomeId> = {},
    private readonly _raw: object[] = [],
  ) {}

  getRawResponse(): object[] {
    return this._raw;
  }
}

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

export interface InsertOneModel<TSchema extends SomeDoc> {
  document: TSchema;
}

export interface ReplaceOneModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
  replacement: TSchema;
  upsert?: boolean;
}

export interface UpdateOneModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
  update: UpdateFilter<TSchema>;
  upsert?: boolean;
}

export interface UpdateManyModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
  update: UpdateFilter<TSchema>;
  upsert?: boolean;
}

export interface DeleteOneModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
}

export interface DeleteManyModel<TSchema extends SomeDoc> {
  filter: Filter<TSchema>;
}
