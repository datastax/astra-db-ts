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

import { SomeDoc, TableSerDes } from '@/src/documents';
import type { RawDataAPIResponse } from '@/src/lib';

export const $SerializeStrict = Symbol('SerializeStrict');
export const $SerializeRelaxed = Symbol('SerializeRelaxed');

export interface DataAPISerDesConfig<Schema extends SomeDoc> {
  table?: TableSerDes<Schema>,
  collection?: TableSerDes<Schema>,
  mutateInPlace?: boolean,
}

export interface DataAPISerCtx<Schema extends SomeDoc> {
  rootObj: Schema,
  mutatingInPlace: boolean,
}

export interface DataAPIDesCtx {
  rootObj: SomeDoc,
  rawDataApiResp: RawDataAPIResponse,
  depth: number,
}

export type DataAPISerFn<Ctx> = (this: Readonly<SomeDoc>, key: string, value: any, ctx: Ctx) => [any, boolean?] | undefined;
export type DataAPIDesFn<Ctx> = (this: SomeDoc, key: string, value: any, ctx: Ctx) => boolean | undefined | void;

export interface DataAPISerDes<Schema extends SomeDoc, SerCtx extends DataAPISerCtx<Schema>, DesCtx extends DataAPIDesCtx> {
  serializer: DataAPISerFn<SerCtx>[],
  deserializer: DataAPIDesFn<DesCtx>[],
  adaptSerCtx: (ctx: DataAPISerCtx<Schema>) => SerCtx,
  adaptDesCtx: (ctx: DataAPIDesCtx) => DesCtx,
  mutateInPlace: boolean,
}

export const serializeObject = <Ctx extends DataAPISerCtx<SomeDoc>>(obj: SomeDoc, depth: number, ctx: Ctx, fns: DataAPISerFn<Ctx>[]) => {
  let ret = obj;

  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];
    const value = obj[key];
    let stop;

    for (let f = 0; f < fns.length; f++) {
      const res = fns[f].call(obj, key, value, ctx);

      if (res !== undefined) {
        if (!ctx.mutatingInPlace && ret === obj) {
          ret = Array.isArray(obj) ? [...obj] : { ...obj };
        }
        ret[key] = res[0];
        stop = res[1];
        break;
      }
    }

    if (!stop && depth < 250 && typeof ret[key] === 'object') {
      ret[key] = serializeObject(ret[key], depth + 1, ctx, fns);
    }
  }

  return ret;
};

export const deserializeObject = <Ctx>(obj: SomeDoc, depth: number, ctx: Ctx, fns: DataAPIDesFn<Ctx>[]) => {
  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];

    let stop;

    for (let f = 0; f < fns.length; f++) {
      const stop = fns[f].call(obj, key, obj[key], ctx);

      if (stop !== true) {
        break;
      }
    }

    if (!stop && depth < 250 && typeof obj[key] === 'object') {
      deserializeObject(obj[key], depth + 1, ctx, fns);
    }
  }

  return obj;
};
