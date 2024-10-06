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
 * Represents *some document*. It's not a base type, but rather more of a
 * bottom type which can represent any legal document, to give more dynamic
 * typing flexibility at the cost of enhanced typechecking/autocomplete.
 *
 * {@link Collection}s will default to this if no specific type is provided.
 *
 * @public
 */
export type SomeDoc = Record<string, any>;

/**
 * Base type for a document that wishes to leverage raw vector capabilities.
 * 
 * @example
 * ```typescript
 * export interface Idea extends VectorDoc {
 *   category: string,
 *   idea: string,
 * }
 * 
 * db.collections<Idea>('ideas').insertOne({
 *   category: 'doors',
 *   idea: 'Upside down doors',
 *   $vector: [.23, .05, .95, .83, .42],
 * });
 * ```
 *
 * @public
 */
export interface VectorDoc {
  /**
   * A raw vector
   */
  $vector?: number[],
}

/**
 * Base type for a document that wishes to leverage automatic vectorization (assuming the collections is vectorize-enabled).
 *
 * @example
 * ```typescript
 * export interface Idea extends VectorizeDoc {
 *   category: string,
 * }
 *
 * db.collections<Idea>('ideas').insertOne({
 *   category: 'doors',
 *   $vectorize: 'Upside down doors',
 * });
 * ```
 *
 * @public
 */
export interface VectorizeDoc {
  /**
   * A string field to be automatically vectorized
   */
  $vectorize: string,
}
