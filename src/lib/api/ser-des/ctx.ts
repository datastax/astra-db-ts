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

import type { Deserializers, RawDataAPIResponse, Serializers } from '@/src/lib/index.js';
import type { PathSegment } from '@/src/lib/types.js';

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
}

/**
 * @public
 */
export const SerDesTarget = <const>{
  Sort: 1 << 0,
  Record: 1 << 1,
  Filter: 1 << 2,
  Update: 1 << 3,
  Projection: 1 << 4,
  InsertedId: 1 << 5,
};

/**
 * @public
 */
export type SerDesTarget = typeof SerDesTarget[keyof typeof SerDesTarget];

/**
 * @public
 */
export interface BaseSerDesCtx {
  rootObj: any,
  path: PathSegment[],
  done<T>(obj?: T): readonly [0, T?],
  recurse<T>(obj?: T): readonly [1, T?],
  replace<T>(obj: T): readonly [2, T],
  nevermind(): readonly [3],
  mapAfter(map: (v: any) => unknown): readonly [3],
  mutatingInPlace: boolean,
  locals: Record<string, any>,
  target: SerDesTarget,
}

export const DONE = 0;
export const RECURSE = 1;
export const REPLACE = 2;
export const NEVERMIND = 3;

const DONE_ARR = [DONE] as const;
const RECURSE_ARR = [RECURSE] as const;
const NEVERMIND_ARR = [NEVERMIND] as const;

/**
 * @internal
 */
export function ctxDone<T>(obj?: T): readonly [typeof DONE, T?] {
  if (arguments.length === 1) {
    return [DONE, obj];
  }
  return DONE_ARR;
}

/**
 * @internal
 */
export function ctxRecurse<T>(obj?: T): readonly [typeof RECURSE, T?] {
  if (arguments.length === 1) {
    return [RECURSE, obj];
  }
  return RECURSE_ARR;
}

/**
 * @internal
 */
export function ctxNevermind(): readonly [typeof NEVERMIND] {
  return NEVERMIND_ARR;
}

/**
 * @internal
 */
export function ctxReplace<T>(obj: T): readonly [typeof REPLACE, T] {
  return [REPLACE, obj];
}
