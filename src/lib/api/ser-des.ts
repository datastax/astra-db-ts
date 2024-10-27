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

import type { SomeDoc } from '@/src/documents';
import type { RawDataAPIResponse } from '@/src/lib';

export const $Serialize = Symbol('serializer');

export interface DataAPISerCtx<Schema extends SomeDoc> {
  rootObj: Schema,
}

export interface DataAPIDesCtx {
  rootObj: SomeDoc,
  rawDataApiResp: RawDataAPIResponse,
  depth: number,
}

export type DataAPISerFn<Ctx> = (this: Readonly<SomeDoc>, key: string, value: any, ctx: Ctx) => [any, boolean?] | undefined;
export type DataAPIDesFn<Ctx> = (this: SomeDoc, key: string, value: any, ctx: Ctx) => boolean | undefined | void;

type DataAPISerFns<Ctx> = [client: DataAPISerFn<Ctx>, user?: DataAPISerFn<Ctx>];
type DataAPIDesFns<Ctx> = [client: DataAPIDesFn<Ctx>, user?: DataAPIDesFn<Ctx>];

export interface DataAPISerDes<Schema extends SomeDoc, SerCtx extends DataAPISerCtx<Schema>, DesCtx extends DataAPIDesCtx> {
  serializer: DataAPISerFns<SerCtx>,
  deserializer: DataAPIDesFns<DesCtx>,
  adaptSerCtx: (ctx: DataAPISerCtx<Schema>) => SerCtx,
  adaptDesCtx: (ctx: DataAPIDesCtx) => DesCtx,
}

export const serializeObject = <Ctx>(obj: SomeDoc, depth: number, ctx: Ctx, fns: DataAPISerFns<Ctx>) => {
  let ret = obj;

  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];
    const value = obj[key];
    let recurse;

    const replacement1 = fns[0].call(obj, key, value, ctx);

    if (replacement1 !== undefined) {
      if (ret === obj) {
        ret = Array.isArray(obj) ? [...obj] : { ...obj };
      }
      ret[key] = replacement1[0];
      recurse = replacement1[1];
    } else {
      const replacement2 = fns[1]?.call(obj, key, value, ctx);

      if (replacement2 !== undefined) {
        if (ret === obj) {
          ret = Array.isArray(obj) ? [...obj] : { ...obj };
        }
        ret[key] = replacement2;
        recurse = false;
      }
    }

    if (recurse !== false && depth < 250 && typeof ret[key] === 'object') {
      ret[key] = serializeObject(ret[key], depth + 1, ctx, fns);
    }
  }

  return ret;
};

export const deserializeObject = <Ctx>(obj: SomeDoc, depth: number, ctx: Ctx, fns: DataAPIDesFns<Ctx>) => {
  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];

    const recurse = fns[1]?.call(obj, key, obj[key], ctx) === true || fns[0].call(obj, key, obj[key], ctx);

    if (recurse && depth < 250 && typeof obj[key] === 'object') {
      deserializeObject(obj[key], depth + 1, ctx, fns);
    }
  }
};
