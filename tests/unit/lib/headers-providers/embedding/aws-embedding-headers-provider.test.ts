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

import { describe, it } from '@/tests/testlib/index.js';
import { AWSEmbeddingHeadersProvider } from '@/src/lib/index.js';
import assert from 'assert';
import fc from 'fast-check';
import { untouchable } from '@/tests/testlib/utils.js';

describe('unit.lib.headers-providers.embedding.aws-embedding-headers-provider', () => {
  it('should return two headers (access & secret)', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (accessKeyId, secretAccessKey) => {
        const provider = new AWSEmbeddingHeadersProvider(accessKeyId, secretAccessKey);

        assert.deepStrictEqual(provider.getHeaders(untouchable()), {
          'x-embedding-access-id': accessKeyId,
          'x-embedding-secret-id': secretAccessKey,
        });
      }),
    );
  });
});
