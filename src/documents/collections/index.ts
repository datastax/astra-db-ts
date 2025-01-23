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
// noinspection DuplicatedCode

export * from './cursor';
export * from './collection';
export type * from './types';

export {
  CollectionSerDesConfig,
  CollDesCtx,
  CollSerCtx,
} from './ser-des/ser-des';

export {
  CollCodecClass,
  CollCodecs,
  CollCodec,
} from './ser-des/codecs';

export {
  CollNumRep,
  GetCollNumRepFn,
  NumCoercionError,
  CollNumRepCfg,
} from './ser-des/big-nums';

export { $DeserializeForCollection } from '@/src/documents/collections/ser-des/constants';
export { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';
