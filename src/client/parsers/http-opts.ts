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

const HttpClients = <const>['fetch-h2', 'fetch', 'custom'];
void EqualityProof<typeof HttpClients[number], DataAPIHttpOptions['client'] & {}, true>;
const parseHttpClient = p.mkStrEnumParser('DataAPILoggingOutput', HttpClients, true);

/**
 * @internal
 */
export const parseHttpOpts: Parser<DataAPIHttpOptions | undefined> = (raw, field) =>  {
  const opts = p.parse('object?')<DataAPIHttpOptions>(raw, field);

  if (!opts) {
    return undefined;
  }

  if (opts.client as string === 'default') {
    throw new Error(`${field}.client cannot be 'default' or undefined. Please use 'fetch-h2' instead if you're trying to emulate astra-db-ts 1.x behavior.`);
  }

  const client = parseHttpClient(opts.client, `${field}.client`);

  const parser = {
    'fetch-h2': parseFetchH2HttpOpts,
    'fetch': parseFetchHttpOpts,
    'custom': parseCustomHttpOpts,
  }[client];

  return parser(opts as any, field);
};

const parseFetchH2HttpOpts: Parser<DefaultHttpClientOptions> = (opts, field) => {
  const preferHttp2 = p.parse('boolean?')(opts.preferHttp2, `${field}.preferHttp2`) ?? true;

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

  return { client: 'fetch-h2', preferHttp2, http1, fetchH2 };
};

const parseFetchHttpOpts: Parser<FetchHttpClientOptions> = () => {
  return { client: 'fetch' };
};

const parseCustomHttpOpts: Parser<CustomHttpClientOptions> = (opts, field) => {
  const fetcher = p.parse('object!', (fetcher, field) => {
    return {
      close: p.parse('function?')(fetcher.close, `${field}.close`),
      fetch: p.parse('function!')(fetcher.fetch, `${field}.fetch`),
    };
  })(opts.fetcher, `${field}.fetcher`);

  return { client: 'custom', fetcher };
};
