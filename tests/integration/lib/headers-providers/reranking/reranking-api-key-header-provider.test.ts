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
import { PureHeadersProvider, RerankingAPIKeyHeaderProvider } from '@/src/lib/index.js';
import assert from 'assert';
import fc from 'fast-check';
import { untouchable } from '@/tests/testlib/utils.js';

describe('integration.lib.headers-providers.reranking.reranking-api-key-header-provider', () => {
  it('should return a single reranking api key header', () => {
    fc.assert(
      fc.property(fc.string(), (apiKey) => {
        const provider = new RerankingAPIKeyHeaderProvider(apiKey);

        assert.deepStrictEqual(provider.getHeaders(untouchable()), {
          'x-rerank-api-key': apiKey,
        });
      }),
    );
  });

  describe('parse', () => {
    it('should convert a string into an RerankingAPIKeyHeaderProvider', () => {
      fc.assert(
        fc.property(fc.string(), (apiKey) => {
          const provider = RerankingAPIKeyHeaderProvider.parse(apiKey);

          assert.deepStrictEqual(provider.getHeaders(untouchable()), {
            'x-rerank-api-key': apiKey,
          });
        }),
      );
    });

    it('should convert null/undefined into an empty RerankingAPIKeyHeaderProvider', () => {
      for (const nullish of [null, undefined]) {
        const provider = RerankingAPIKeyHeaderProvider.parse(nullish);
        assert.deepStrictEqual(provider.getHeaders(untouchable()), {});
      }
    });

    it('should be the identity function over a HeaderProvider', () => {
      const HP = new class extends PureHeadersProvider { getHeaders = () => ({ 'a': 'b' }); };
      assert.strictEqual(RerankingAPIKeyHeaderProvider.parse(HP), HP);
    });

    it('should throw on non-string, non-nullish', () => {
      fc.assert(
        fc.property(fc.anything().filter((x) => typeof x !== 'string' && x !== null && x !== undefined), (x) => {
          assert.throws(() => RerankingAPIKeyHeaderProvider.parse(x), TypeError);
        }),
      );
    });
  });
});
