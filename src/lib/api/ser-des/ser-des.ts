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
import { KeyTransformer, nullish, OneOrMany, RawDataAPIResponse } from '@/src/lib';
import { toArray } from '@/src/lib/utils';
import { CodecSerDesFns } from '@/src/lib/api/ser-des/codecs';
import { BaseDesCtx, BaseSerCtx, BaseSerDesCtx, ctxContinue, ctxDone, ctxNext, DONE } from '@/src/lib/api/ser-des/ctx';

/**
 * @public
 */
export type SerDesFn<Ctx> = (key: string, value: any, ctx: Ctx) => readonly [0 | 1 | 2, any?] | 'Return ctx.done(val?), ctx.recurse(val?), or ctx.continue()';

/**
 * @public
 */
export interface BaseSerDesConfig<Fns extends CodecSerDesFns, SerCtx extends BaseSerCtx<Fns>, DesCtx extends BaseDesCtx<Fns>> {
  serialize?: OneOrMany<SerDesFn<SerCtx>>,
  deserialize?: OneOrMany<SerDesFn<DesCtx>>,
  mutateInPlace?: boolean,
  keyTransformer?: KeyTransformer,
}

/**
 * @internal
 */
export abstract class SerDes<Fns extends CodecSerDesFns = any, SerCtx extends BaseSerCtx<Fns> = any, DesCtx extends BaseDesCtx<Fns> = any> {
  protected constructor(protected readonly _cfg: BaseSerDesConfig<Fns, SerCtx, DesCtx>) {}

  public serialize<S extends SomeDoc | nullish>(obj: S): [S, boolean] {
    if (!obj) {
      return [obj, false];
    }

    const ctx = this.adaptSerCtx(this._mkCtx(obj, {
      mutatingInPlace: this._cfg.mutateInPlace === true,
    }));

    return [
      serializeRecord('', { ['']: ctx.rootObj }, ctx, toArray(this._cfg.serialize!))[''] as S,
      this.bigNumsPresent(ctx),
    ];
  }

  public deserialize<S extends SomeDoc | nullish>(obj: SomeDoc | nullish, raw: RawDataAPIResponse, parsingId = false): S {
    if (obj === null || obj === undefined) {
      return obj as S;
    }

    const ctx = this.adaptDesCtx(this._mkCtx(obj, {
      parsingInsertedId: parsingId,
      rawDataApiResp: raw,
      keys: [],
    }));

    return deserializeRecord('', { ['']: ctx.rootObj }, ctx, toArray(this._cfg.deserialize!))[''] as S;
  }

  protected abstract adaptSerCtx(ctx: BaseSerCtx<Fns>): SerCtx;
  protected abstract adaptDesCtx(ctx: BaseDesCtx<Fns>): DesCtx;
  protected abstract bigNumsPresent(ctx: SerCtx): boolean;

  protected static _mergeConfig<Fns extends CodecSerDesFns, SerCtx extends BaseSerCtx<Fns>, DesCtx extends BaseDesCtx<Fns>>(...cfg: (BaseSerDesConfig<Fns, SerCtx, DesCtx> | undefined)[]): BaseSerDesConfig<Fns, SerCtx, DesCtx> {
    return cfg.reduce<BaseSerDesConfig<Fns, SerCtx, DesCtx>>((acc, cfg) => ({
      serialize: [...toArray(cfg?.serialize ?? []), ...toArray(acc.serialize ?? [])],
      deserialize: [...toArray(cfg?.deserialize ?? []), ...toArray(acc.deserialize ?? [])],
      mutateInPlace: !!(cfg?.mutateInPlace ?? acc.mutateInPlace),
      keyTransformer: cfg?.keyTransformer ?? acc.keyTransformer,
    }), {});
  }

  private _mkCtx<Ctx>(obj: SomeDoc, ctx: Ctx): Ctx & BaseSerDesCtx<Fns> {
    return {
      done: ctxDone,
      next: ctxNext,
      continue: ctxContinue,
      codecs: null!,
      keyTransformer: this._cfg.keyTransformer,
      rootObj: obj,
      path: [],
      ...ctx,
    };
  }
}

function serializeRecord<Ctx extends BaseSerCtx<any>>(key: string, obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  const stop = applySerdesFns(fns, key, obj, ctx);

  if (!stop && ctx.path.length < 250 && typeof obj[key] === 'object' && obj[key] !== null) {
    obj[key] = serializeRecordHelper(obj[key], ctx, fns);
  }

  return obj;
}

function serializeRecordHelper<Ctx extends BaseSerCtx<any>>(obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  obj = (!ctx.mutatingInPlace)
    ? (Array.isArray(obj) ? [...obj] : { ...obj })
    : obj;

  const path = ctx.path;
  path.push('<temp>');

  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    let key = keys[i];
    path[path.length - 1] = key;

    serializeRecord(key, obj, ctx, fns);

    if (ctx.keyTransformer) {
      const oldKey = key;
      key = ctx.keyTransformer.serializeKey(key, ctx);

      if (key !== oldKey) {
        obj[key] = obj[oldKey];
        delete obj[oldKey];
      }
    }
  }

  path.pop();
  return obj;
}

function deserializeRecord<Ctx extends BaseDesCtx<any>>(key: string, obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  const value = obj[key];

  ctx.keys = (typeof value === 'object' && value !== null)
    ? Object.keys(value)
    : [];

  const stop = applySerdesFns(fns, key, obj, ctx);

  if (!stop && ctx.path.length < 250) {
    if (obj[key] === value) {
      deserializeRecordHelper(ctx.keys, value, ctx, fns);
    } else {
      deserializeRecordHelper(Object.keys(obj[key]), obj[key], ctx, fns);
    }
  }

  return obj;
}

function deserializeRecordHelper<Ctx extends BaseDesCtx<any>>(keys: string[], obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  const path = ctx.path;
  path.push('<temp>');

  for (let i = keys.length; i--;) {
    let key = keys[i];
    path[path.length - 1] = key;

    if (ctx.keyTransformer) {
      const oldKey = key;
      key = ctx.keyTransformer.deserializeKey(key, ctx);

      if (key !== oldKey) {
        obj[key] = obj[oldKey];
        delete obj[oldKey];
        path[path.length - 1] = key;
      }
    }

    deserializeRecord(key, obj, ctx, fns);
  }

  path.pop();
}

function applySerdesFns<Ctx>(fns: readonly SerDesFn<Ctx>[], key: string, obj: SomeDoc, ctx: Ctx): boolean {
  for (let f = 0; f < fns.length; f++) {
    const res = fns[f](key, obj[key], ctx) as [number] | [number, unknown];

    if (res.length === 2) {
      obj[key] = res[1];
    }

    if (res?.[0] === DONE) {
      return true;
    }
  }

  return false;
}
