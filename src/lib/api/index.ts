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

export * from './fetch/fetch-h2';
export * from './fetch/fetch-native';
export { DEFAULT_KEYSPACE } from './constants';

export type {
  Fetcher,
  FetcherRequestInfo,
  FetcherResponseInfo,
} from './fetch/types';

export type {
  RawDataAPIResponse,
} from './types';

export type {
  BaseSerDesConfig,
  SerDesFn,
} from './ser-des/ser-des';

export type {
  Codecs,
  CodecSerDesFns,
  TypeCodec,
  ClassGuardCodec,
  NameCodec,
  PathCodec,
  CustomGuardCodec,
  SomeCodec,
  RawCodec,
  CodecOpts,
} from './ser-des/codecs';

export type {
  BaseSerDesCtx,
  BaseSerCtx,
  BaseDesCtx,
} from './ser-des/ctx';

export type {
  TimeoutDescriptor,
  WithTimeout,
  TimedOutCategories,
} from './timeouts';

export {
  Camel2SnakeCase,
  KeyTransformer,
} from './ser-des/key-transformer';
