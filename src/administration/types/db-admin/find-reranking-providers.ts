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
 * The overarching result containing the `rerankingProviders` map.
 *
 * **Temporarily dynamically typed. In a future release, the type will be strengthened.**
 *
 * @field rerankingProviders - Map of reranking provider names to info about said provider.
 *
 * @see DbAdmin.findRerankingProviders
 *
 * @public
 */
export interface FindRerankingProvidersResult {
  /**
   * A map of reranking provider names (e.g. `nvidia`), to information about said provider (e.g. models/auth).
   *
   * @example
   * ```typescript
   * {
   *   nvidia: {
   *     displayName: 'Nvidia',
   *     ...,
   *   }
   * }
   * ```
   *
   * **Temporarily typed as `any`. In a future release, the type will be strengthened.**
   */
  rerankingProviders: Record<string, any>,
}
