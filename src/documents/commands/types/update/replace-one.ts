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

import type { CommandOptions } from '@/src/lib/index.js';
import type { Sort } from '@/src/documents/index.js';

/**
 * Represents the options for some generic `replaceOne` command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 * @field timeout - The timeout override for this method
 *
 * @public
 */
export interface GenericReplaceOneOptions extends CommandOptions<{ timeout: 'generalMethodTimeoutMs' }> {
  upsert?: boolean,
  sort?: Sort,
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Use `sort: { $vector: [...] }` instead.
   */
  vector?: 'ERROR: Use `sort: { $vector: [...] }` instead',
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Use `sort: { $vectorize: '...' }` instead.
   */
  vectorize?: 'ERROR: Use `sort: { $vectorize: "..." }` instead',
}
