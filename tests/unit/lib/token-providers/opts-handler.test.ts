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
import { describe, it, TEST_APPLICATION_TOKEN } from '@/tests/testlib';
import { StaticTokenProvider, TokenProvider, UsernamePasswordTokenProvider } from '@/src/lib';
import { OptionParseError } from '@/src/lib/opts-handler';
import { ensureMonoidalHandlerIsActuallyAMonoid } from '@/tests/testlib/opts-handler/validate-monoid';
import { ParsedTokenProvider } from '@/src/lib/token-providers/token-provider';

describe('unit.lib.token-providers.opts-handler', () => {
  describe('parse', () => {
    const parseEq = (opts: typeof TokenProvider.opts.parseable, exp: TokenProvider) => {
      const parsed = TokenProvider.opts.parse(opts);
      assert.ok(parsed instanceof exp.constructor);
      assert.deepStrictEqual(parsed, exp);
      assert.deepStrictEqual(parsed.getToken(), exp.getToken());
    };

    const parseErr = (cfg: any) => {
      assert.throws(() => TokenProvider.opts.parse(cfg), OptionParseError);
    };

    it('should return the empty value on undefined', () => {
      parseEq(undefined, TokenProvider.opts.empty);
    });

    it('should convert a string to a StaticTokenProvider', () => {
      parseEq('hello', new StaticTokenProvider('hello'));
      parseEq(TEST_APPLICATION_TOKEN, new StaticTokenProvider(TEST_APPLICATION_TOKEN));
      parseEq('', new StaticTokenProvider(''));
    });

    it('should return the same object if it is already a TokenProvider', () => {
      const provider = new StaticTokenProvider('hello');
      parseEq(provider, provider);

      const provider2 = new (class extends TokenProvider { getToken() { return 'a j f a'; } });
      parseEq(provider2, provider2);

      const provider3 = TokenProvider.opts.empty;
      parseEq(provider3, provider3);
    });

    it('should throw an error on invalid input', () => {
      parseErr(null);
      parseErr(1);
      parseErr([new StaticTokenProvider('3')]);
      parseErr({ getToken() { return 'raaaaa deeeee ooooo'; } });
    });
  });

  describe('concat', () => {
    const tp1 = new StaticTokenProvider('hello') as unknown as ParsedTokenProvider;
    const tp2 = new UsernamePasswordTokenProvider('username', 'password') as unknown as ParsedTokenProvider;
    const tp3 = new (class extends TokenProvider { getToken() { return 'how do you even say hietala'; } }) as unknown as ParsedTokenProvider;
    const tp4 = tp1 as unknown as ParsedTokenProvider;
    const emp = TokenProvider.opts.empty;

    it('should choose the right-most non-empty token provider', () => {
      assert.deepStrictEqual(TokenProvider.opts.concat(tp1, tp2, tp3, tp4), tp4);
      assert.deepStrictEqual(TokenProvider.opts.concat(emp, emp, emp, tp4), tp4);
      assert.deepStrictEqual(TokenProvider.opts.concat(tp1, tp2, emp, emp), tp2);
      assert.deepStrictEqual(TokenProvider.opts.concat(emp, emp, emp, emp), emp);
      assert.deepStrictEqual(TokenProvider.opts.concat(emp, emp, tp3, emp), tp3);
    });

    ensureMonoidalHandlerIsActuallyAMonoid(TokenProvider.opts, [tp1, tp2, tp3, tp4]);
  });
});
