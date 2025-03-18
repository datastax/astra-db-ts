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

import assert from 'assert';
import { describe, it } from '@/tests/testlib/index.js';
import { HeadersResolver } from '@/src/lib/api/clients/headers-resolver.js';
import { EmbeddingAPIKeyHeaderProvider, HeadersProvider, TokenProvider } from '@/src/lib/index.js';
import { DEFAULT_DATA_API_AUTH_HEADER } from '@/src/lib/api/constants.js';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';

describe('unit.lib.api.clients.headers-resolver', () => {
  function mergeObjsIgnoringUndefined(...objs: Record<string, string | undefined>[]) {
    return objs.reduce((acc, h) => {
      Object.entries(h).forEach(([k, v]) => {
        if (v !== undefined) {
          acc[k] = v;
        }
      });
      return acc;
    }, {});
  }

  describe('static', () => {
    it('should resolve headers statically when using all pure header providers', () => {
      const providers = HeadersProvider.opts.monoid.concat([
        HeadersProvider.opts.fromObj.parse({ 'x-foo': 'baz' }),
        HeadersProvider.opts.fromStr(EmbeddingAPIKeyHeaderProvider).parse('api-key'),
        TokenProvider.opts.parse('old').toHeadersProvider(),
        TokenProvider.opts.parse('new').toHeadersProvider(),
      ]);

      const hr = new HeadersResolver('data-api', providers, {
        'x-foo': 'bar',
        'car': 'bus',
      });

      assert.strictEqual(hr['_resolveStrategy'].constructor.name, 'StaticHeadersResolveStrategy');

      const headers = hr.resolve();

      assert.ok(!(headers instanceof Promise));
      assert.deepStrictEqual(headers, {
        'x-foo': 'baz',
        'x-embedding-api-key': 'api-key',
        [DEFAULT_DATA_API_AUTH_HEADER]: 'new',
        'car': 'bus',
      });
    });

    it('should ignore all undefined headers', async () => {
      const rawHeadersArb = fc.array(fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.constant(undefined))));
      const baseHeadersArb = arbs.record(fc.string());

      await fc.assert(
        fc.asyncProperty(rawHeadersArb, baseHeadersArb, async (rawHeaders, baseHeaders) => {
          const providers = HeadersProvider.opts.monoid.concat(
            rawHeaders.map((h) => HeadersProvider.opts.fromObj.parse(h)),
          );

          const hr = new HeadersResolver('data-api', providers, baseHeaders);
          const headers = hr.resolve();

          const expected = mergeObjsIgnoringUndefined(baseHeaders, ...rawHeaders);

          assert.ok(!(headers instanceof Promise));
          assert.deepStrictEqual(headers, expected);
        }),
      );
    });
  });

  describe('dynamic', () => {
    it('should resolve headers dynamically when not using all pure header providers', async () => {
      const providers = HeadersProvider.opts.monoid.concat([
        HeadersProvider.opts.fromObj.parse({ 'x-foo': 'baz' }),
        HeadersProvider.opts.fromStr(EmbeddingAPIKeyHeaderProvider).parse('api-key'),
        HeadersProvider.opts.fromObj.parse(new class extends HeadersProvider {
          public async getHeaders() {
            return { 'async': 'header-old1' };
          }
        }),
        HeadersProvider.opts.fromObj.parse(new class extends HeadersProvider {
          public async getHeaders() {
            return { 'async': 'header-old2' };
          }
        }),
        TokenProvider.opts.parse('old').toHeadersProvider(),
        HeadersProvider.opts.fromObj.parse(new class extends HeadersProvider {
          public async getHeaders() {
            return { 'async': 'header-new' };
          }
        }),
        TokenProvider.opts.parse('new').toHeadersProvider(),
      ]);

      const hr = new HeadersResolver('data-api', providers, {
        'x-foo': 'bar',
        'car': 'bus',
      });

      assert.strictEqual(hr['_resolveStrategy'].constructor.name, 'DynamicHeadersResolveStrategy');

      const headers = hr.resolve();

      assert.ok(headers instanceof Promise);
      assert.deepStrictEqual(await headers, {
        'x-foo': 'baz',
        'x-embedding-api-key': 'api-key',
        'async': 'header-new',
        [DEFAULT_DATA_API_AUTH_HEADER]: 'new',
        'car': 'bus',
      });
    });

    it('should ignore all undefined headers', async () => {
      const rawHeadersArb = fc.array(fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.constant(undefined))));
      const baseHeadersArb = arbs.record(fc.string());

      await fc.assert(
        fc.asyncProperty(rawHeadersArb, baseHeadersArb, async (rawHeaders, baseHeaders) => {
          fc.pre(rawHeaders.length > 0);

          const providers = HeadersProvider.opts.monoid.concat(
            rawHeaders.map((h, i) => {
              if (Math.random() > .25 && i !== 0) {
                return HeadersProvider.opts.fromObj.parse(h);
              }

              return HeadersProvider.opts.fromObj.parse(new (class extends HeadersProvider {
                public async getHeaders() {
                  return h;
                }
              })());
            }),
          );

          const hr = new HeadersResolver('data-api', providers, baseHeaders);
          const headers = hr.resolve();

          const expected = mergeObjsIgnoringUndefined(baseHeaders, ...rawHeaders);

          assert.ok(headers instanceof Promise);
          assert.deepStrictEqual(await headers, expected);
        }),
      );
    });
  });
});
