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

import type { AdditionalHeaders, HeadersProviderVariants } from '@/src/lib/headers-providers/index.js';
import { HeadersProvider, StaticHeadersProvider } from '@/src/lib/headers-providers/index.js';
import type { MonoidType, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handlers.js';
import { MonoidalOptionsHandler, monoids } from '@/src/lib/opts-handlers.js';
import type { DecoderType } from 'decoders';
import { either, nullish, optional, record, string } from 'decoders';
import { anyInstanceOf, isNullish, oneOrMany } from '@/src/lib/utils.js';

/**
 * @internal
 */
const monoid = monoids.object({
  providers: monoids.array<HeadersProvider>(),
});

/**
 * @internal
 */
export type ParsedHeadersProviders = MonoidType<typeof monoid> & Parsed<'HeadersProvider'>;

/**
 * @internal
 */
interface StrBasedTypes extends OptionsHandlerTypes {
  Parsed: ParsedHeadersProviders,
  Parseable: HeadersProvider | string | undefined | null,
  Decoded: DecoderType<typeof decoderFromStr>,
}

/**
 * @internal
 */
const decoderFromStr = nullish(either(
  anyInstanceOf(HeadersProvider),
  string,
));

/**
 * @internal
 */
export const StringBasedHeadersProviderOptsHandler = <Tag extends HeadersProviderVariants>(kleisli: new (value: string) => HeadersProvider<Tag>) => {
  const transformer = decoderFromStr
    .transform((input) => {
      if (typeof input === 'string') {
        return { providers: [new kleisli(input)] };
      }

      if (isNullish(input)) {
        return monoid.empty;
      }

      return { providers: [input] };
    });

  return new MonoidalOptionsHandler<StrBasedTypes>(transformer, monoid);
};

/**
 * @internal
 */
interface ObjBasedTypes extends OptionsHandlerTypes {
  Parsed: ParsedHeadersProviders,
  Parseable: AdditionalHeaders | undefined | null,
  Decoded: DecoderType<typeof decoderFromObj>,
}

/**
 * @internal
 */
const decoderFromObj = nullish(oneOrMany(either(
  anyInstanceOf(HeadersProvider),
  record(optional(string)),
)));

/**
 * @internal
 */
export const ObjectBasedHeadersProviderOptsHandler = (() => {
  const transformer = decoderFromObj.transform((input) => {
    if (!input) {
      return monoid.empty;
    }

    const asArray = (!Array.isArray(input)) ? [input] : input;

    const providers = asArray.map((value) => {
      if (value instanceof HeadersProvider) {
        return value;
      }
      return new StaticHeadersProvider(value);
    });

    return { providers };
  });
  return new MonoidalOptionsHandler<ObjBasedTypes>(transformer, monoid);
})();

HeadersProvider.opts = {
  fromStr: StringBasedHeadersProviderOptsHandler,
  fromObj: ObjectBasedHeadersProviderOptsHandler,
  monoid: monoid as MonoidType<ParsedHeadersProviders>,
  parsed: null!,
};
