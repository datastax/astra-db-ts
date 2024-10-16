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

import { EqualityProof, p } from '@/src/lib/validation';
import {
  CustomHttpClientOptions,
  DataAPIHttpOptions,
  DefaultHttpClientOptions,
  FetchHttpClientOptions,
} from '@/src/client';
import { SomeDoc } from '@/src/documents';

const HttpClients = <const>['default', 'fetch', 'custom'];
void EqualityProof<typeof HttpClients[number], DataAPIHttpOptions['client'] & {}, true>;
const parseHttpClient = p.mkStrEnumParser('DataAPILoggingOutput', HttpClients, false);

export const parseHttpOpts = p.do<DataAPIHttpOptions | undefined>(function* (raw, field) {
  const opts = yield* p.parse('object?')(raw, field);

  if (!opts) {
    return undefined;
  }

  const client = (yield* parseHttpClient(opts.client, `${field}.client`)) ?? 'default';

  const parser = {
    default: parseDefaultHttpOpts,
    fetch: parseFetchHttpOpts,
    custom: parseCustomHttpOpts,
  }[client];

  return yield* parser(opts, field);
});

const parseDefaultHttpOpts = p.do<DefaultHttpClientOptions, SomeDoc>(function* (opts, field) {
  const preferHttp2 = (yield* p.parse('boolean?')(opts.preferHttp2, `${field}.preferHttp2`)) ?? true;
  const maxTimeMS = yield* p.parse('number?')(opts.maxTimeMS, `${field}.maxTimeMS`);

  const http1 = yield* p.parse('object?', p.do(function* (http1, field) {
    return {
      keepAlive: yield* p.parse('boolean?')(http1.keepAlive, `${field}.keepAlive`),
      keepAliveMS: yield* p.parse('number?')(http1.keepAliveMS, `${field}.keepAliveMS`),
      maxSockets: yield* p.parse('number?')(http1.maxSockets, `${field}.maxSockets`),
      maxFreeSockets: yield* p.parse('number?')(http1.maxFreeSockets, `${field}.maxFreeSockets`),
    };
  }))(opts.http1, `${field}.http1`);

  const fetchH2 = yield* p.parse('object?', p.do(function* (fetchH2, field) {
    return {
      TimeoutError: yield* p.parse('function!')(fetchH2.TimeoutError, `${field}.TimeoutError`),
      context: yield* p.parse('function!')(fetchH2.context, `${field}.context`),
    };
  }))(opts.fetchH2, `${field}.fetchH2`);

  return { client: 'default', preferHttp2, maxTimeMS, http1, fetchH2 };
});

const parseFetchHttpOpts = p.do<FetchHttpClientOptions, SomeDoc>(function* (opts, field) {
  const maxTimeMS = yield* p.parse('number?')(opts.maxTimeMS, `${field}.maxTimeMS`);
  return { client: 'fetch', maxTimeMS };
});

const parseCustomHttpOpts = p.do<CustomHttpClientOptions, SomeDoc>(function* (opts, field) {
  const maxTimeMS = yield* p.parse('number?')(opts.maxTimeMS, `${field}.maxTimeMS`);

  const fetcher = yield* p.parse('object!', p.do(function* (fetcher, field) {
    return {
      close: yield* p.parse('function?')(fetcher.close, `${field}.close`),
      fetch: yield* p.parse('function!')(fetcher.fetch, `${field}.fetch`),
    };
  }))(opts.fetchH2, `${field}.fetchH2`);

  return { client: 'custom', maxTimeMS, fetcher };
});
