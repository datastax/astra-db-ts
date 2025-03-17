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

import { StaticHeadersProvider } from '@/src/lib/headers-providers/index.js';

/**
 * ##### Overview
 *
 * An embedding headers provider which translates AWS access keys into the appropriate authentication headers for
 * AWS-based embedding providers (e.g. `bedrock`).
 *
 * Sets the headers `x-embedding-access-id` and `x-embedding-secret-id`.
 *
 * @example
 * ```typescript
 * const provider = new AWSEmbeddingHeadersProvider(
 *   'access-key-id',
 *   'secret-access-key',
 * );
 * const collections = await db.collections('my_coll', { embeddingApiKey: provider });
 * ```
 *
 * @see EmbeddingHeadersProvider
 *
 * @public
 */
export class AWSEmbeddingHeadersProvider extends StaticHeadersProvider<'embedding'> {
  /**
   * Constructs an instead of the {@link AWSEmbeddingHeadersProvider}.
   *
   * @param accessKeyId - The access key ID part of the AWS access keys
   * @param secretAccessKey - The secret access key part of the AWS access keys
   */
  public constructor(accessKeyId: string, secretAccessKey: string) {
    const headers = {
      'x-embedding-access-id': accessKeyId,
      'x-embedding-secret-id': secretAccessKey,
    };
    super(headers);
  }
}
