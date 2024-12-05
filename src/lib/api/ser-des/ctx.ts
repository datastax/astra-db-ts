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

import { ClassGuardCodec, CodecSerDesFns, CustomGuardCodec, NameCodec, TypeCodec } from '@/src/lib/api/ser-des/codecs';
import { SomeDoc } from '@/src/documents';
import type { RawDataAPIResponse } from '@/src/lib';

export interface BaseSerCtx<Fns extends CodecSerDesFns> extends BaseSerDesCtx<Fns> {
  rootObj: SomeDoc,
  mutatingInPlace: boolean,
  depth: number,
}

export interface BaseDesCtx<Fns extends CodecSerDesFns> extends BaseSerDesCtx<Fns> {
  rootObj: SomeDoc,
  rawDataApiResp: RawDataAPIResponse,
  depth: number,
  numKeysInValue: number,
  keys: string[] | null,
}

export interface BaseSerDesCtx<Fns extends CodecSerDesFns> {
  done<T>(obj?: T): readonly [0, T?],
  done<T>(key?: string, obj?: T): readonly [0, T, string],
  recurse<T>(obj?: T): readonly [1, T?],
  recurse<T>(key?: string, obj?: T): readonly [1, T, string],
  continue<T>(obj?: T): readonly [2, T?],
  continue<T>(key?: string, obj?: T): readonly [2, T, string],
  nameCodecs: Record<string, NameCodec<Fns>>;
  typeCodecs: Record<string, TypeCodec<Fns>>;
  classGuardCodecs: ClassGuardCodec<Fns>[];
  customGuardCodecs: CustomGuardCodec<Fns>[];
  customState: Record<string, any>,
  camelSnakeCache?: Record<string, string>,
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
export function ctxDone<T>(obj?: T): readonly [0, T?];

/**
 * @internal
 */
export function ctxDone<T>(key?: string, obj?: T): readonly [0, T, string];

export function ctxDone<T>(objOrKey?: string | T, obj?: T): readonly [0, T, string] | readonly [0, T?] {
  switch (arguments.length) {
    case 1: return [DONE, objOrKey as T];
    case 2: return [DONE, obj as T, objOrKey as string];
    default: return DONE_ARR;
  }
}

/**
 * @internal
 */
export function ctxRecurse<T>(obj?: T): readonly [1, T?];

/**
 * @internal
 */
export function ctxRecurse<T>(key?: string, obj?: T): readonly [1, T, string];

export function ctxRecurse<T>(objOrKey?: string | T, obj?: T): readonly [1, T, string] | readonly [1, T?] {
  switch (arguments.length) {
    case 1: return [RECURSE, objOrKey as T];
    case 2: return [RECURSE, obj as T, objOrKey as string];
    default: return RECURSE_ARR;
  }
}

/**
 * @internal
 */
export function ctxContinue<T>(obj?: T): readonly [2, T?];

/**
 * @internal
 */
export function ctxContinue<T>(key?: string, obj?: T): readonly [2, T, string];

export function ctxContinue<T>(objOrKey?: string | T, obj?: T): readonly [2, T, string] | readonly [2, T?] {
  switch (arguments.length) {
    case 1: return [CONTINUE, objOrKey as T];
    case 2: return [CONTINUE, obj as T, objOrKey as string];
    default: return CONTINUE_ARR;
  }
}
