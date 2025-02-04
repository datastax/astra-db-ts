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

import { WithTimeout } from '@/src/lib';

/**
 * Options for creating a new index via {@link Table.createVectorIndex}
 *
 * @public
 */
export interface CreateTableVectorIndexOptions extends WithTimeout<'tableAdminTimeoutMs'> {
  /**
   * Options available for the vector index.
   */
  options?: TableVectorIndexOptions,
  /**
   * If `true`, no error will be thrown if the index already exists.
   *
   * Note that this does not check if the existing index is the same as the one attempting to be created; it simply
   * checks if the name is already in use.
   */
  ifNotExists?: boolean,
}

/**
 * Options aviailable for the vector index
 *
 * @public
 */
export interface TableVectorIndexOptions {
  /**
   * The similarity metric to use for the index.
   */
  metric?: 'cosine' | 'euclidean' | 'dot_product',
  /**
   * Enable certain vector optimizations on the index by specifying the source model for your vectors, such as (not exhaustive) `'openai_v3_large'`, `'openai_v3_small'`, `'ada002'`, `'gecko'`, `'bert'`, or `'other'` (default).
   */
  sourceModel?: (string & Record<never, never>) | 'other',
}
