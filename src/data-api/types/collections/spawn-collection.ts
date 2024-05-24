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

import { WithNamespace } from '@/src/data-api';

/**
 * Options for spawning a new collection.
 *
 * @public
 */
export interface CollectionSpawnOptions extends WithNamespace {
  /**
   * The API key for the embedding service to use
   */
  embeddingApiKey?: string,
  /**
   * The default `maxTimeMS` for all operations on the collection. Will override the maxTimeMS set in the DataAPIClient
   * options; it can be overridden on a per-operation basis.
   *
   * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
   * for this time before considering the request to have timed out.
   *
   * The request may or may not still be running on the server after this time.
   */
  defaultMaxTimeMS?: number,
}
