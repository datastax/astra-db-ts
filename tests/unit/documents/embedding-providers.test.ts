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

import assert from 'assert';
import { describe, it } from '@/tests/testlib';
import { AWSEmbeddingHeadersProvider, EmbeddingAPIKeyHeaderProvider } from '@/src/documents';

describe('unit.common.embedding-providers', () => {
  describe('EmbeddingAPIKeyHeaderProvider', () => {
    it('should provide the proper header for an api key', () => {
      const ehp = new EmbeddingAPIKeyHeaderProvider('key');
      assert.deepStrictEqual(ehp.getHeaders(), { 'x-embedding-api-key': 'key' });
    });

    it('should provide no headers for a nullish api key', () => {
      const ehp1 = new EmbeddingAPIKeyHeaderProvider(undefined);
      const ehp2 = new EmbeddingAPIKeyHeaderProvider(null);
      assert.deepStrictEqual(ehp1.getHeaders(), {});
      assert.deepStrictEqual(ehp2.getHeaders(), {});
    });
  });

  describe('AWSEmbeddingHeadersProvider', () => {
    it('should provide the proper headers for the AWS access keys', () => {
      const tp = new AWSEmbeddingHeadersProvider('access', 'secret');
      assert.deepStrictEqual(tp.getHeaders(), { 'x-embedding-access-id': 'access', 'x-embedding-secret-id': 'secret' });
    });
  });
});
