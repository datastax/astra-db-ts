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
