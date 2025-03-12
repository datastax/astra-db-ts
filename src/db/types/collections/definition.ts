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

import type { SomeDoc } from '@/src/documents/collections/index.js';
import type {
  CollectionDefaultIdOptions,
  CollectionIndexingOptions,
  CollectionLexicalOptions, CollectionRerankingOptions,
  CollectionVectorOptions,
} from '@/src/db/index.js';

/**
 * Represents the options for the createCollection command.
 *
 * @field vector - Options related to vector search.
 * @field indexing - Options related to indexing.
 * @field defaultId - Options related to the default ID.
 *
 * @public
 */
export interface CollectionDefinition<Schema extends SomeDoc> {
  /**
   * Options related to vector search.
   */
  vector?: CollectionVectorOptions,
  /**
   * Options related to indexing.
   */
  indexing?: CollectionIndexingOptions<Schema>,
  /**
   * Options related to the default ID.
   */
  defaultId?: CollectionDefaultIdOptions,
  /**
   * Options related to lexical (bm25) search.
   */
  lexical?: CollectionLexicalOptions,
  /**
   * Options related to reranking.
   */
  reranking?: CollectionRerankingOptions,
}
