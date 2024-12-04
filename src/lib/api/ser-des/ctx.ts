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
  done<T>(obj?: T): [T, true] | true,
  done<T>(key?: string, obj?: T): [string, T, true],
  continue<T>(obj?: T): [T, false] | false,
  continue<T>(key?: string, obj?: T): [string, T, false],
  nameCodecs: Record<string, NameCodec<Fns>>;
  typeCodecs: Record<string, TypeCodec<Fns>>;
  classGuardCodecs: ClassGuardCodec<Fns>[];
  customGuardCodecs: CustomGuardCodec<Fns>[];
  customState: Record<string, any>,
}

export function ctxDone<T>(obj?: T): [T, true] | true
export function ctxDone<T>(key?: string, obj?: T): [string, T, true]
export function ctxDone<T>(objOrKey?: string | T, obj?: T): [string, T, true] | [T, true] | true {
  switch (arguments.length) {
    case 1: return [objOrKey as T, true];
    case 2: return [objOrKey as string, obj!, true];
    default: return true;
  }
}

export function ctxContinue<T>(obj?: T): [T, false] | false
export function ctxContinue<T>(key?: string, obj?: T): [string, T, false]
export function ctxContinue<T>(objOrKey?: string | T, obj?: T): [string, T, false] | [T, false] | false {
  switch (arguments.length) {
    case 1: return [objOrKey as T, false];
    case 2: return [objOrKey as string, obj!, false];
    default: return false;
  }
}
