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
import { camelToSnakeCase, snakeToCamelCase, toArray } from '@/src/lib/utils';
import {
  ClassGuardCodec,
  CodecHolder,
  CodecSerDesFns,
  CustomGuardCodec,
  NameCodec,
  TypeCodec,
} from '@/src/lib/api/ser-des/codecs';
import { BaseDesCtx, BaseSerCtx, BaseSerDesCtx, ctxDone, ctxContinue } from '@/src/lib/api/ser-des/ctx';

export type SerDesFn<Ctx> = (this: SomeDoc, key: string, value: any, ctx: Ctx) => [any, boolean] | boolean | void | 'Return ctx.done(val?), ctx.continue(val?), or void';

export interface SerDesConfig<Codec extends CodecHolder, Fns extends CodecSerDesFns, SerCtx extends BaseSerCtx<Fns>, DesCtx extends BaseDesCtx<Fns>> {
  serialize?: OneOrMany<SerDesFn<SerCtx>>,
  deserialize?: OneOrMany<SerDesFn<DesCtx>>,
  mutateInPlace?: boolean,
  snakeCaseInterop?: boolean,
  codecs?: Codec[],
}

/**
 * @internal
 */
export abstract class SerDes<Fns extends CodecSerDesFns = any, SerCtx extends BaseSerCtx<Fns> = any, DesCtx extends BaseDesCtx<Fns> = any> {
  protected readonly _nameCodecs: Record<string, NameCodec<Fns>>;
  protected readonly _typeCodecs: Record<string, TypeCodec<Fns>>;
  protected readonly _customGuardCodecs: CustomGuardCodec<Fns>[];
  protected readonly _classGuardCodecs: ClassGuardCodec<Fns>[];
  protected readonly _customState: Record<string, any> = {};

  protected constructor(protected readonly _cfg: SerDesConfig<any, Fns, SerCtx, DesCtx>) {
    this._nameCodecs = {};
    this._typeCodecs = {};
    const codecs = this._cfg?.codecs?.map(c => c.get) ?? [];

    for (const codec of codecs) {
      if (codec.codecType === 'name') {
        this._nameCodecs[codec.name] = codec;
      } else {
        this._typeCodecs[codec.type] = codec;
      }
    }

    this._customGuardCodecs = Object.values(codecs).filter((codec) => 'serializeGuard' in codec);
    this._classGuardCodecs = Object.values(codecs).filter((codec) => 'serializeClass' in codec);

    if (this._cfg.snakeCaseInterop) {
      this._customState.camelSnakeCache = {};
    }
  }

  public serializeRecord<S extends SomeDoc | nullish>(obj: S): [S, boolean] {
    if (obj === null || obj === undefined) {
      return [obj, false];
    }
    const ctx = this.adaptSerCtx(this._mkCtx({ rootObj: obj, depth: 0, mutatingInPlace: this._cfg.mutateInPlace === true }));
    return [serializeRecord({ ['']: ctx.rootObj }, 0, ctx, toArray(this._cfg.serialize!), !!this._cfg.snakeCaseInterop)[''] as S, this.bigNumsPresent(ctx)];
  }

  public deserializeRecord<S extends SomeDoc | nullish>(obj: SomeDoc | nullish, raw: RawDataAPIResponse): S {
    if (obj === null || obj === undefined) {
      return obj as S;
    }
    const ctx = this.adaptDesCtx(this._mkCtx({ rootObj: obj, rawDataApiResp: raw, depth: 0, numKeysInValue: 0, keys: [] }));
    return deserializeRecord([''], { ['']: ctx.rootObj }, 0, ctx, toArray(this._cfg.deserialize!), !!this._cfg.snakeCaseInterop)[''] as S;
  }

  protected abstract adaptSerCtx(ctx: BaseSerCtx<Fns>): SerCtx;
  protected abstract adaptDesCtx(ctx: BaseDesCtx<Fns>): DesCtx;
  protected abstract bigNumsPresent(ctx: SerCtx): boolean;

  protected static _mergeConfig<Codec extends CodecHolder, Fns extends CodecSerDesFns, SerCtx extends BaseSerCtx<Fns>, DesCtx extends BaseDesCtx<Fns>>(...cfg: (SerDesConfig<Codec, Fns, SerCtx, DesCtx> | undefined)[]): SerDesConfig<Codec, Fns, SerCtx, DesCtx> {
    return cfg.reduce<SerDesConfig<Codec, Fns, SerCtx, DesCtx>>((acc, cfg) => ({
      serialize: [...toArray(cfg?.serialize ?? []), ...toArray(acc.serialize ?? [])],
      deserialize: [...toArray(cfg?.deserialize ?? []), ...toArray(acc.deserialize ?? [])],
      mutateInPlace: !!(cfg?.mutateInPlace ?? acc.mutateInPlace),
      snakeCaseInterop: !!(cfg?.snakeCaseInterop ?? acc.snakeCaseInterop),
      codecs: [...acc.codecs ?? [], ...cfg?.codecs ?? []],
    }), {});
  }

  private _mkCtx<Ctx>(ctx: Ctx): Ctx & BaseSerDesCtx<Fns> {
    return {
      done: ctxDone,
      continue: ctxContinue,
      nameCodecs: this._nameCodecs,
      typeCodecs: this._typeCodecs,
      classGuardCodecs: this._classGuardCodecs,
      customGuardCodecs: this._customGuardCodecs,
      customState: this._customState,
      ...ctx,
    };
  }
}

const serializeRecord = <Ctx extends BaseSerCtx<any>>(obj: SomeDoc, depth: number, ctx: Ctx, fns: readonly SerDesFn<Ctx>[], snake: boolean) => {
  const ret: SomeDoc = (!ctx.mutatingInPlace)
    ? (Array.isArray(obj) ? [...obj] : { ...obj })
    : obj;

  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    let key = keys[i];
    const value = obj[key];
    let stop;

    ctx.depth = depth;

    if (snake) {
      const oldKey = key;
      key = camelToSnakeCase(key, ctx.customState.camelSnakeCache);
      obj[key] = value;
      delete obj[oldKey];
    }

    for (let f = 0; f < fns.length && !stop; f++) {
      const res = fns[f].call(obj, key, value, ctx);

      if (!res) {
        continue;
      }

      if (typeof res === 'object') {
        if (res.length === 2) {
          ret[key] = res[0];
          stop = res[1];
        } else {
          const oldKey = key;
          key = res[0];
          obj[key] = res[1];
          delete obj[oldKey];
          stop = res[2];
        }
      } else {
        stop = res;
      }
    }

    if (!stop && depth < 250 && typeof ret[key] === 'object' && ret[key] !== null) {
      ret[key] = serializeRecord(ret[key], depth + 1, ctx, fns, snake);
    }
  }

  return ret;
};

const deserializeRecord = <Ctx extends BaseDesCtx<any>>(keys: string[], obj: SomeDoc, depth: number, ctx: Ctx, fns: readonly SerDesFn<Ctx>[], snake: boolean) => {
  for (let i = keys.length; i--;) {
    let key = keys[i];
    const value = obj[key];
    let stop;

    ctx.keys = (typeof value === 'object' && value !== null)
      ? Object.keys(value)
      : [];

    ctx.depth = depth;

    if (snake) {
      const oldKey = key;
      key = snakeToCamelCase(key, ctx.customState.camelSnakeCache);
      obj[key] = value;
      delete obj[oldKey];
    }

    for (let f = 0; f < fns.length && !stop; f++) {
      const res = fns[f].call(obj, key, value, ctx);

      if (!res) {
        continue;
      }

      if (typeof res === 'object') {
        if (res.length === 2) {
          obj[key] = res[0];
          stop = res[1];
        } else {
          const oldKey = key;
          key = res[0];
          obj[key] = res[1];
          delete obj[oldKey];
          stop = res[2];
        }
      } else {
        stop = res;
      }
    }

    if (!stop && depth < 250) {
      if (obj[key] === value) {
        deserializeRecord(ctx.keys, value, depth + 1, ctx, fns, snake);
      } else {
        deserializeRecord(Object.keys(obj[key]), obj[key], depth + 1, ctx, fns, snake);
      }
    }
  }

  return obj;
};
