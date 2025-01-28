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

import { Deserializers, KeyTransformer, RawDataAPIResponse, Serializers } from '@/src/lib';

/**
 * @public
 */
export interface BaseSerCtx<SerCex> extends BaseSerDesCtx {
  serializers: Serializers<SerCex>,
}

/**
 * @public
 */
export interface BaseDesCtx<DesCtx> extends BaseSerDesCtx {
  deserializers: Deserializers<DesCtx>,
  rawDataApiResp: RawDataAPIResponse,
  parsingInsertedId: boolean,
}

/**
 * @public
 */
export interface BaseSerDesCtx {
  rootObj: any,
  path: (string | number)[],
  done<T>(obj?: T): readonly [0, T?],
  recurse<T>(obj?: T): readonly [1, T?],
  continue<T>(obj?: T): readonly [2, T?],
  mapAfter(map: (v: any) => unknown): readonly [2],
  keyTransformer?: KeyTransformer,
  mutatingInPlace: boolean,
}

export const DONE = 0 as const;
export const RECURSE = 1 as const;
export const CONTINUE = 2 as const;

const DONE_ARR = [DONE] as const;
const RECURSE_ARR = [RECURSE] as const;
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
export function ctxRecurse<T>(obj?: T): readonly [1, T?] {
  if (arguments.length === 1) {
    return [RECURSE, obj];
  }
  return RECURSE_ARR;
}

/**
 * @internal
 */
export function ctxContinue<T>(obj?: T): readonly [2, T?] {
  if (arguments.length === 1) {
    return [CONTINUE, obj];
  }
  return CONTINUE_ARR;
}
