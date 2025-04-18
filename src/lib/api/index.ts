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

export * from './fetch/fetch-h2.js';
export * from './fetch/fetch-native.js';
export type { Fetcher, FetcherRequestInfo, FetcherResponseInfo } from './fetch/fetcher.js';
export { DEFAULT_KEYSPACE } from './constants.js';

export type * from './types.js';

export type {
  BaseSerDesConfig,
  SerDesFn,
  SerDesFnRet,
} from './ser-des/ser-des.js';

export type {
  RawCodec,
  Serializers,
  Deserializers,
  SerDesGuard,
  CustomCodecOpts,
  CustomCodecSerOpts,
  DataAPICodec,
  NominalCodecOpts,
  TypeCodecOpts,
} from './ser-des/codecs.js';

export type { BaseSerDesCtx, BaseSerCtx, BaseDesCtx } from './ser-des/ctx.js';
export { SerDesTarget } from './ser-des/ctx.js';

export type {
  TimeoutDescriptor,
  WithTimeout,
  TimedOutCategories,
} from './timeouts/timeouts.js';
