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
  type Decoder,
  define,
  either,
  inexact,
  nullish,
  object,
  optional,
  positiveInteger,
  taggedUnion,
} from 'decoders';
import { function_ } from '@/src/lib/utils.js';
import type { OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler.js';
import { OptionsHandler } from '@/src/lib/opts-handler.js';
import type { HttpOptions } from '@/src/client/index.js';
import type { FetchCtx } from '@/src/lib/api/fetch/fetcher.js';
import { FetchH2, type FetchH2Like, FetchNative, type SomeConstructor } from '@/src/lib/index.js';
import type { SomeDoc } from '@/src/documents/index.js';
import { betterTypeOf } from '@/src/documents/utils.js';

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: FetchCtx & Parsed<'HttpOptions'>,
  Parseable: HttpOptions | undefined | null,
}

const fetchH2 = define<FetchH2Like>((module, ok, err) => {
  if (module && typeof module === 'object') {
    const verified = inexact({
      TimeoutError: function_ as unknown as Decoder<SomeConstructor>,
      context: function_,
    }).verify({
      TimeoutError: (module as SomeDoc).TimeoutError,
      context: (module as SomeDoc).context,
    });

    return ok(verified);
  } else {
    return err(`fetchH2 should be set to \`import * as fetchH2 from 'fetch-h2'\` or \`const fetchH2 = require('fetch-h2')\`; got ${betterTypeOf(module)}`);
  }
});

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
    fetchH2: fetchH2,
  }),
  'fetch': object({
    client: constant('fetch'),
  }),
  'custom': object({
    client: constant('custom'),
    fetcher: inexact({
      fetch: function_,
      close: optional(function_),
    }),
  }),
}));

/**
 * @internal
 */
const transformer = decoder.transform((opts): FetchCtx => {
  const ctx =
    (opts?.client === 'fetch-h2')
      ? new FetchH2(opts) :
    (opts?.client === 'custom')
      ? opts.fetcher
      : new FetchNative();

  return {
    ctx: ctx,
    closed: { ref: false },
  };
});

/**
 * @internal
 */
export const HttpOptsHandler = new OptionsHandler<Types>(transformer);
