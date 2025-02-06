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

export { CollectionFindCursor } from './cursor.js';
export { Collection } from './collection.js';
export type * from './types/index.js';

export type {
  CollectionSerDesConfig,
  CollectionDesCtx,
  CollectionSerCtx,
} from './ser-des/ser-des.js';

export type { CollectionCodecClass, CollectionCodec } from './ser-des/codecs.js';
export { CollectionCodecs } from './ser-des/codecs.js';

export type { CollNumRep, GetCollNumRepFn, CollNumRepCfg } from './ser-des/big-nums.js';
export { NumCoercionError } from './ser-des/big-nums.js';

export { $DeserializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
export { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
