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

import {
  boolean,
  constant,
  DecoderType,
  either,
  inexact,
  nullish,
  object,
  optional,
  positiveInteger,
  taggedUnion,
} from 'decoders';
import { function_ } from '@/src/lib/utils';
import { OptionsHandler, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler';
import { DataAPIHttpOptions } from '@/src/client';
import type { FetchCtx, Fetcher } from '@/src/lib/api/fetch/types';
import { FetchH2, FetchNative } from '@/src/lib';

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: FetchCtx & Parsed<'DataAPIHttpOptions'>,
  Parseable: DataAPIHttpOptions | undefined | null,
}

/**
 * @internal
 */
const decoder = nullish(taggedUnion('client', {
  'fetch-h2': object({
    client: constant('fetch-h2'),
    preferHttp2: optional(boolean),
    http1: optional(object({
      keepAlive: optional(boolean),
      keepAliveMS: optional(positiveInteger),
      maxSockets: optional(positiveInteger),
      maxFreeSockets: optional(either(positiveInteger, constant(Infinity))),
    })),
    fetchH2: optional(inexact({
      TimeoutError: function_,
      context: function_,
    })),
  }),
  'fetch': object({
    client: constant('fetch'),
  }),
  'custom': object({
    client: constant('custom'),
    fetcher: object({
      fetch: function_,
      close: optional(function_),
    }),
  }),
}));

/**
 * @internal
 */
const transformer = decoder.transform((input): FetchCtx => {
  const ctx =
    (input?.client === 'fetch')
      ? new FetchNative() :
    (input?.client === 'custom')
      ? input.fetcher
      : tryLoadFetchH2(input?.client, input);

  return {
    ctx: ctx,
    closed: { ref: false },
  };
});

/**
 * @internal
 */
export const HttpOptsHandler = new OptionsHandler<Types>(transformer);

const tryLoadFetchH2 = (clientType: 'fetch-h2' | undefined, options: DecoderType<typeof decoder> & { client: 'fetch-h2' } | undefined | null): Fetcher => {
  try {
    const preferHttp2 = options?.preferHttp2 ?? true;
    return new FetchH2(options, preferHttp2);
  } catch (e) {
    if (!clientType) {
      return new FetchNative();
    } else {
      throw e;
    }
  }
};
