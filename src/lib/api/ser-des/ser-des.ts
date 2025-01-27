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
import {
  Deserializers,
  KeyTransformer,
  nullish,
  OneOrMany,
  processCodecs,
  RawCodec,
  RawDataAPIResponse,
  Serializers,
} from '@/src/lib';
import { toArray } from '@/src/lib/utils';
import {
  BaseDesCtx,
  BaseSerCtx,
  BaseSerDesCtx,
  ctxContinue,
  ctxDone,
  ctxNevermind,
  DONE,
} from '@/src/lib/api/ser-des/ctx';

/**
 * @public
 */
export type SerDesFn<Ctx> = (value: any, ctx: Ctx) => SerDesFnRet | 'Return ctx.done(val?), ctx.continue(val?), or ctx.nevermind()';

/**
 * @public
 */
export type SerDesFnRet = readonly [0 | 1 | 2, any?];

/**
 * @public
 */
export interface BaseSerDesConfig<SerCtx extends BaseSerCtx<any>, DesCtx extends BaseDesCtx<any>> {
  codecs?: (readonly RawCodec<SerCtx, DesCtx>[])[],
  serialize?: OneOrMany<SerDesFn<SerCtx>>,
  deserialize?: OneOrMany<SerDesFn<DesCtx>>,
  mutateInPlace?: boolean,
  keyTransformer?: KeyTransformer,
}

/**
 * @internal
 */
export abstract class SerDes<SerCtx extends BaseSerCtx<any> = any, DesCtx extends BaseDesCtx<any> = any> {
  private readonly _serializers: Serializers<SerCtx>;
  private readonly _deserializers: Deserializers<DesCtx>;

  protected constructor(protected readonly _cfg: BaseSerDesConfig<SerCtx, DesCtx>) {
    [this._serializers, this._deserializers] = processCodecs(this._cfg.codecs?.flat() ?? []);
  }

  public serialize<S extends SomeDoc | nullish>(obj: S): [S, boolean] {
    if (!obj) {
      return [obj, false];
    }

    const ctx = this.adaptSerCtx(this._mkCtx(obj, {
      mutatingInPlace: this._cfg.mutateInPlace === true,
      serializers: this._serializers,
    }));

    const serialized = serializeRecord('', { ['']: ctx.rootObj }, ctx, toArray(this._cfg.serialize!))[''];

    return [
      ctx.keyTransformer?.serialize(serialized, ctx) ?? serialized,
      this.bigNumsPresent(ctx),
    ];
  }

  public deserialize<S extends SomeDoc | nullish>(obj: SomeDoc | nullish, raw: RawDataAPIResponse, parsingId = false): S {
    if (obj === null || obj === undefined) {
      return obj as S;
    }

    const ctx = this.adaptDesCtx(this._mkCtx(obj, {
      deserializers: this._deserializers,
      parsingInsertedId: parsingId,
      rawDataApiResp: raw,
    }));

    const rootObj = {
      ['']: ctx.keyTransformer?.deserialize(ctx.rootObj, ctx) ?? ctx.rootObj,
    };

    return deserializeRecord('', rootObj, ctx, toArray(this._cfg.deserialize!))[''] as S;
  }

  protected abstract adaptSerCtx(ctx: BaseSerCtx<SerCtx>): SerCtx;
  protected abstract adaptDesCtx(ctx: BaseDesCtx<DesCtx>): DesCtx;
  protected abstract bigNumsPresent(ctx: SerCtx): boolean;

  protected static _mergeConfig<SerCtx extends BaseSerCtx<any>, DesCtx extends BaseDesCtx<any>>(...cfg: (BaseSerDesConfig<SerCtx, DesCtx> | undefined)[]): BaseSerDesConfig<SerCtx, DesCtx> {
    return cfg.reduce<BaseSerDesConfig<SerCtx, DesCtx>>((acc, cfg) => ({
      serialize: [...toArray(cfg?.serialize ?? []), ...toArray(acc.serialize ?? [])],
      deserialize: [...toArray(cfg?.deserialize ?? []), ...toArray(acc.deserialize ?? [])],
      mutateInPlace: !!(cfg?.mutateInPlace ?? acc.mutateInPlace),
      keyTransformer: cfg?.keyTransformer ?? acc.keyTransformer,
      codecs: [...(cfg?.codecs ?? []), ...(acc.codecs ?? [])],
    }), {});
  }

  private _mkCtx<Ctx>(obj: SomeDoc, ctx: Ctx): Ctx & BaseSerDesCtx {
    return {
      done: ctxDone,
      continue: ctxContinue,
      nevermind: ctxNevermind,
      keyTransformer: this._cfg.keyTransformer,
      mapAfter: null!,
      rootObj: obj,
      path: [],
      ...ctx,
    };
  }
}

function serializeRecord<Ctx extends BaseSerCtx<any>>(key: string | number, obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  const postMaps: ((v: any) => unknown)[] = [];
  ctx.mapAfter = (fn) => postMaps.push(fn);

  const stop = applySerdesFns(fns, key, obj, ctx);

  if (!stop && ctx.path.length < 250 && typeof obj[key] === 'object' && obj[key] !== null) {
    obj[key] = serializeRecordHelper(obj[key], ctx, fns);
  }

  for (let i = postMaps.length - 1; i >= 0; i--) {
    obj[key] = postMaps[i](obj[key]);
  }
  return obj;
}

function serializeRecordHelper<Ctx extends BaseSerCtx<any>>(obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  obj = (!ctx.mutatingInPlace)
    ? (Array.isArray(obj) ? [...obj] : { ...obj })
    : obj;

  const path = ctx.path;
  path.push('<temp>');

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      path[path.length - 1] = i;
      serializeRecord(i, obj, ctx, fns);
    }
  } else {
    for (const key of Object.keys(obj)) {
      path[path.length - 1] = key;
      serializeRecord(key, obj, ctx, fns);
    }
  }

  path.pop();
  return obj;
}

function deserializeRecord<Ctx extends BaseDesCtx<any>>(key: string | number, obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  const postMaps: ((v: any) => unknown)[] = [];
  ctx.mapAfter = (fn) => postMaps.push(fn);

  const stop = applySerdesFns(fns, key, obj, ctx);

  if (!stop && ctx.path.length < 250 && typeof obj[key] === 'object' && obj[key] !== null) {
    deserializeRecordHelper(obj[key], ctx, fns);
  }

  for (let i = postMaps.length - 1; i >= 0; i--) {
    obj[key] = postMaps[i](obj[key]);
  }
  return obj;
}

function deserializeRecordHelper<Ctx extends BaseDesCtx<any>>(obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  const path = ctx.path;
  path.push('<temp>');

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      path[path.length - 1] = i;
      deserializeRecord(i, obj, ctx, fns);
    }
  } else {
    for (const key of Object.keys(obj)) {
      path[path.length - 1] = key;
      deserializeRecord(key, obj, ctx, fns);
    }
  }

  path.pop();
}

function applySerdesFns<Ctx>(fns: readonly SerDesFn<Ctx>[], key: string | number, obj: SomeDoc, ctx: Ctx): boolean {
  for (let f = 0; f < fns.length; f++) {
    const res = fns[f](obj[key], ctx) as [number] | [number, unknown];

    if (res.length === 2) {
      obj[key] = res[1];
    }

    if (res?.[0] === DONE) {
      return true;
    }
  }
  return false;
}
