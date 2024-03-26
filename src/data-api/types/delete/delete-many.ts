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

/** @internal */
export interface DeleteManyCommand {
  deleteMany: {
    filter: Record<string, unknown>;
  }
}

/**
 * Represents the result of a delete command.
 *
 * @field deletedCount - The number of deleted documents. Can be any non-negative integer.
 *
 * @see Collection.deleteMany
 */
export interface DeleteManyResult {
  /**
   * The number of deleted documents.
   */
  deletedCount: number;
}
