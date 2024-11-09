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

import { EqualityProof, p, Parser } from '@/src/lib/validation';
import type {
  CustomHttpClientOptions,
  DataAPIHttpOptions,
  DefaultHttpClientOptions,
  FetchHttpClientOptions,
} from '@/src/client';

const HttpClients = <const>['default', 'fetch', 'custom'];
void EqualityProof<typeof HttpClients[number], DataAPIHttpOptions['client'] & {}, true>;
const parseHttpClient = p.mkStrEnumParser('DataAPILoggingOutput', HttpClients, false);

export const parseHttpOpts: Parser<DataAPIHttpOptions | undefined> = (raw, field) =>  {
  const opts = p.parse('object?')<DataAPIHttpOptions>(raw, field);

  if (!opts) {
    return undefined;
  }

  const client = parseHttpClient(opts.client, `${field}.client`) ?? 'default';

  const parser = {
    default: parseDefaultHttpOpts,
    fetch: parseFetchHttpOpts,
    custom: parseCustomHttpOpts,
  }[client];

  return parser(opts as any, field);
};

const parseDefaultHttpOpts: Parser<DefaultHttpClientOptions> = (opts, field) => {
  const preferHttp2 = p.parse('boolean?')(opts.preferHttp2, `${field}.preferHttp2`) ?? true;
  const maxTimeMS = p.parse('number?')(opts.maxTimeMS, `${field}.maxTimeMS`);

  const http1 = p.parse('object?', (http1, field) => {
    return {
      keepAlive: p.parse('boolean?')(http1.keepAlive, `${field}.keepAlive`),
      keepAliveMS: p.parse('number?')(http1.keepAliveMS, `${field}.keepAliveMS`),
      maxSockets: p.parse('number?')(http1.maxSockets, `${field}.maxSockets`),
      maxFreeSockets: p.parse('number?')(http1.maxFreeSockets, `${field}.maxFreeSockets`),
    };
  })(opts.http1, `${field}.http1`);

  const fetchH2 = p.parse('object?', (fetchH2, field) => {
    return {
      TimeoutError: p.parse('function!')(fetchH2.TimeoutError, `${field}.TimeoutError`),
      context: p.parse('function!')(fetchH2.context, `${field}.context`),
    };
  })(opts.fetchH2, `${field}.fetchH2`);

  return { client: 'default', preferHttp2, maxTimeMS, http1, fetchH2 };
};

const parseFetchHttpOpts: Parser<FetchHttpClientOptions> = (opts, field) => {
  const maxTimeMS = p.parse('number?')(opts.maxTimeMS, `${field}.maxTimeMS`);
  return { client: 'fetch', maxTimeMS };
};

const parseCustomHttpOpts: Parser<CustomHttpClientOptions> = (opts, field) => {
  const maxTimeMS = p.parse('number?')(opts.maxTimeMS, `${field}.maxTimeMS`);

  const fetcher = p.parse('object!', (fetcher, field) => {
    return {
      close: p.parse('function?')(fetcher.close, `${field}.close`),
      fetch: p.parse('function!')(fetcher.fetch, `${field}.fetch`),
    };
  })(opts.fetcher, `${field}.fetcher`);

  return { client: 'custom', maxTimeMS, fetcher };
};
