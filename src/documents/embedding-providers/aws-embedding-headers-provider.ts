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

import { EmbeddingHeadersProvider } from '@/src/documents/embedding-providers/embedding-headers-provider';

/**
 * An embedding headers provider which translates AWS access keys into the appropriate authentication headers for
 * AWS-based embedding providers (bedrock).
 *
 * Sets the headers `x-embedding-access-id` and `x-embedding-secret-id`.
 *
 * @example
 * ```typescript
 * const provider = new AWSEmbeddingHeadersProvider('access-key-id', 'secret-access-key');
 * const collection = await db.collection('my_coll', { embeddingApiKey: provider });
 * ```
 *
 * @see EmbeddingHeadersProvider
 *
 * @public
 */
export class AWSEmbeddingHeadersProvider extends EmbeddingHeadersProvider {
  readonly #headers: Record<string, string>;

  /**
   * Constructs an instead of the {@link TokenProvider}.
   *
   * @param accessKeyId - The access key ID part of the AWS access keys
   * @param secretAccessKey - The secret access key part of the AWS access keys
   */
  constructor(accessKeyId: string, secretAccessKey: string) {
    super();
    this.#headers = {
      'x-embedding-access-id': accessKeyId,
      'x-embedding-secret-id': secretAccessKey,
    };
  }

  /**
   * Returns the appropriate embedding auth headers.
   *
   * @returns the appropriate embedding auth headers.
   */
  override getHeaders(): Record<string, string> {
    return this.#headers;
  }
}
