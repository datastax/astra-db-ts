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

import { Codecs, CodecSerDesFns } from '@/src/lib/api/ser-des/codecs';
import { SomeDoc } from '@/src/documents';
import { KeyTransformer, RawDataAPIResponse } from '@/src/lib';

/**
 * @public
 */
export interface BaseSerCtx<Fns extends CodecSerDesFns> extends BaseSerDesCtx<Fns> {
  mutatingInPlace: boolean,
}

/**
 * @public
 */
export interface BaseDesCtx<Fns extends CodecSerDesFns> extends BaseSerDesCtx<Fns> {
  rawDataApiResp: RawDataAPIResponse,
  parsingInsertedId: boolean,
  keys: string[] | null,
}

/**
 * @public
 */
export interface BaseSerDesCtx<Fns extends CodecSerDesFns> {
  rootObj: SomeDoc,
  path: string[],
  done<T>(obj?: T): readonly [0, T?],
  next<T>(obj?: T): readonly [1, T?],
  continue(): readonly [2],
  codecs: Codecs<Fns>,
  keyTransformer?: KeyTransformer,
}

export const DONE = 0 as const;
export const NEXT = 1 as const;
export const CONTINUE = 2 as const;

const DONE_ARR = [DONE] as const;
const RECURSE_ARR = [NEXT] as const;
const CONTINUE_ARR = [CONTINUE] as const;

/**
 * @internal
 */
export function ctxDone<T>(obj?: T): readonly [0, T?] {
  if (arguments.length === 1) {
    return [DONE, obj];
  }
  return DONE_ARR;
}

/**
 * @internal
 */
export function ctxNext<T>(obj?: T): readonly [1, T?] {
  if (arguments.length === 1) {
    return [NEXT, obj];
  }
  return RECURSE_ARR;
}

/**
 * @internal
 */
export function ctxContinue(): readonly [2] {
  return CONTINUE_ARR;
}
