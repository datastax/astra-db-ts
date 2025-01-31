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

import { boolean, constant, either, inexact, object, optional, positiveInteger, taggedUnion } from 'decoders';
import { function_, isNullish } from '@/src/lib/utils';
import { DecoderType, OptionsHandler, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler';
import { DataAPIHttpOptions } from '@/src/client';
import type { FetchCtx, Fetcher } from '@/src/lib/api/fetch/types';
import { FetchH2, FetchNative } from '@/src/lib';

/**
 * @internal
 */
interface HttpOptsTypes extends OptionsHandlerTypes {
  Parsed: FetchCtx & Parsed<'DataAPIHttpOptions'>,
  Parseable: DataAPIHttpOptions | undefined,
  Decoded: DecoderType<typeof httpOpts>,
}

const httpOpts = optional(taggedUnion('client', {
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
export const HttpOptsHandler = new OptionsHandler<HttpOptsTypes>({
  decoder: httpOpts,
  refine(input) {
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
  },
});

const tryLoadFetchH2 = (clientType: 'fetch-h2' | undefined, options: HttpOptsTypes['Decoded'] & { client: 'fetch-h2' } | undefined): Fetcher => {
  try {
    const preferHttp2 = options?.preferHttp2 ?? true;
    return new FetchH2(options, preferHttp2);
  } catch (e) {
    if (isNullish(clientType)) {
      return new FetchNative();
    } else {
      throw e;
    }
  }
};
