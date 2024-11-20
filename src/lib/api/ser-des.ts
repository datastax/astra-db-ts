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

import { SomeDoc } from '@/src/documents';
import type { nullish, OneOrMany, RawDataAPIResponse } from '@/src/lib';
import { toArray } from '@/src/lib/utils';

export interface DataAPISerCtx<Schema extends SomeDoc> {
  rootObj: Schema,
  mutatingInPlace: boolean,
}

export interface DataAPIDesCtx {
  rootObj: SomeDoc,
  rawDataApiResp: RawDataAPIResponse,
  depth: number,
}


export type DataAPISerFn<Ctx> = (this: SomeDoc, key: string, value: any, ctx: Ctx) => [any, boolean?] | boolean | void;

export type DataAPIDesFn<Ctx> = (this: SomeDoc, key: string, value: any, ctx: Ctx) => [any, boolean?] | boolean | void;

export interface DataAPISerDesConfig<Schema extends SomeDoc, SerCtx extends DataAPISerCtx<Schema>, DesCtx extends DataAPIDesCtx> {
  serialize?: OneOrMany<DataAPISerFn<SerCtx>>,
  deserialize?: OneOrMany<DataAPIDesFn<DesCtx>>,
  mutateInPlace?: boolean,
}

/**
 * @internal
 */
export type SomeSerDes = DataAPISerDes<SomeDoc, any, any>;

/**
 * @internal
 */
export abstract class DataAPISerDes<Schema extends SomeDoc, SerCtx extends DataAPISerCtx<Schema>, DesCtx extends DataAPIDesCtx> {
  protected constructor(protected readonly _cfg: DataAPISerDesConfig<Schema, SerCtx, DesCtx>) {}

  public serializeRecord<S extends Schema | nullish>(obj: S): [S, boolean] {
    if (obj === null || obj === undefined) {
      return [obj, false];
    }
    const ctx = this.adaptSerCtx({ rootObj: obj, mutatingInPlace: this._cfg.mutateInPlace === true });
    return [_serializeRecord({ ['']: ctx.rootObj }, 0, ctx, toArray(this._cfg.serialize!))[''] as S, this.bigNumsPresent(ctx)];
  }

  public deserializeRecord<S extends Schema | nullish>(obj: SomeDoc | nullish, raw: RawDataAPIResponse): S {
    if (obj === null || obj === undefined) {
      return obj as S;
    }
    const ctx = this.adaptDesCtx({ rootObj: obj, rawDataApiResp: raw, depth: 0 });
    return _deserializeRecord({ ['']: ctx.rootObj }, 0, ctx, toArray(this._cfg.deserialize!))[''] as S;
  }

  protected abstract adaptSerCtx(ctx: DataAPISerCtx<Schema>): SerCtx;
  protected abstract adaptDesCtx(ctx: DataAPIDesCtx): DesCtx;
  protected abstract bigNumsPresent(ctx: SerCtx): boolean;

  protected static _mergeConfig<Schema extends SomeDoc, SerCtx extends DataAPISerCtx<Schema>, DesCtx extends DataAPIDesCtx>(...cfg: (DataAPISerDesConfig<Schema, SerCtx, DesCtx> | undefined)[]): DataAPISerDesConfig<Schema, SerCtx, DesCtx> {
    return cfg.reduce<DataAPISerDesConfig<Schema, SerCtx, DesCtx>>((acc, cfg) => ({
      serialize: [...toArray(cfg?.serialize ?? []), ...toArray(acc.serialize ?? [])],
      deserialize: [...toArray(cfg?.deserialize ?? []), ...toArray(acc.deserialize ?? [])],
      mutateInPlace: cfg?.mutateInPlace ?? acc.mutateInPlace,
    }), { serialize: [], deserialize: [], mutateInPlace: false });
  }
}

const _serializeRecord = <Ctx extends DataAPISerCtx<SomeDoc>>(obj: SomeDoc, depth: number, ctx: Ctx, fns: readonly DataAPISerFn<Ctx>[]) => {
  let ret = obj;

  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];
    const value = obj[key];
    let stop;

    for (let f = 0; f < fns.length; f++) {
      const res = fns[f].call(obj, key, value, ctx);

      if (res) {
        if (!ctx.mutatingInPlace && ret === obj) {
          ret = Array.isArray(obj) ? [...obj] : { ...obj };
        }

        if (typeof res === 'object' && <any>res !== null) {
          ret[key] = res[0];
          stop = res[1];
        } else {
          stop = res;
        }

        if (stop) {
          break;
        }
      }
    }

    if (!stop && depth < 250 && typeof ret[key] === 'object' && ret[key] !== null) {
      ret[key] = _serializeRecord(ret[key], depth + 1, ctx, fns);
    }
  }

  return ret;
};

const _deserializeRecord = <Ctx>(obj: SomeDoc, depth: number, ctx: Ctx, fns: readonly DataAPIDesFn<Ctx>[]) => {
  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];

    let stop;

    for (let f = 0; f < fns.length; f++) {
      const res = fns[f].call(obj, key, obj[key], ctx);

      if (res) {
        if (typeof res === 'object' && <any>res !== null) {
          obj[key] = res[0];
          stop = res[1];
        } else {
          stop = res;
        }

        if (stop) {
          break;
        }
      }
    }

    if (!stop && depth < 250 && typeof obj[key] === 'object' && obj[key] !== null) {
      _deserializeRecord(obj[key], depth + 1, ctx, fns);
    }
  }

  return obj;
};
