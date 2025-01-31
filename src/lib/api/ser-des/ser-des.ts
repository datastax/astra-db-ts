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
  CONTINUE,
  ctxContinue,
  ctxDone,
  ctxRecurse,
  DONE,
} from '@/src/lib/api/ser-des/ctx';
import { InternalSerDesConfig } from '@/src/lib/api/ser-des/cfg-handler';

/**
 * @public
 */
export type SerDesFn<Ctx> = (value: any, ctx: Ctx) => SerDesFnRet | 'Return ctx.done(val?), ctx.recurse(val?), or ctx.continue(val?)';

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

  protected constructor(protected readonly _cfg: InternalSerDesConfig<BaseSerDesConfig<SerCtx, DesCtx>> & {}) {
    [this._serializers, this._deserializers] = processCodecs(this._cfg.codecs?.flat() ?? []);
  }

  public serialize(obj: unknown): [unknown, boolean] {
    if (obj === null || obj === undefined) {
      return [obj, false];
    }

    const ctx = this.adaptSerCtx(this._mkCtx(obj, {
      mutatingInPlace: this._cfg.mutateInPlace === true,
      serializers: this._serializers,
    }));

    const serialized = serdesRecord('', { ['']: ctx.rootObj }, ctx, toArray(this._cfg.serialize!))[''];

    return [
      ctx.keyTransformer?.serialize(serialized, ctx) ?? serialized,
      this.bigNumsPresent(ctx),
    ];
  }

  public deserialize<S extends unknown | nullish>(obj: unknown | nullish, raw: RawDataAPIResponse, parsingId = false): S {
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

    return serdesRecord('', rootObj, ctx, toArray(this._cfg.deserialize!))[''] as S;
  }

  protected abstract adaptSerCtx(ctx: BaseSerCtx<SerCtx>): SerCtx;
  protected abstract adaptDesCtx(ctx: BaseDesCtx<DesCtx>): DesCtx;
  protected abstract bigNumsPresent(ctx: SerCtx): boolean;

  private _mkCtx<Ctx>(obj: unknown, ctx: Ctx): Ctx & BaseSerDesCtx {
    return {
      done: ctxDone,
      recurse: ctxRecurse,
      continue: ctxContinue,
      keyTransformer: this._cfg.keyTransformer,
      mutatingInPlace: true,
      mapAfter: null!,
      rootObj: obj,
      path: [],
      ...ctx,
    };
  }
}

function serdesRecord<Ctx extends BaseSerDesCtx>(key: string | number, obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  const postMaps: ((v: any) => unknown)[] = [];
  ctx.mapAfter = (fn) => { postMaps.push(fn); return [CONTINUE]; };

  const stop = applySerdesFns(fns, key, obj, ctx);

  if (!stop && ctx.path.length < 250 && typeof obj[key] === 'object' && obj[key] !== null) {
    obj[key] = serdesRecordHelper(obj[key], ctx, fns);
  }

  for (let i = postMaps.length - 1; i >= 0; i--) {
    obj[key] = postMaps[i](obj[key]);
  }
  return obj;
}

function serdesRecordHelper<Ctx extends BaseSerDesCtx>(obj: SomeDoc, ctx: Ctx, fns: readonly SerDesFn<Ctx>[]) {
  obj = (!ctx.mutatingInPlace)
    ? (Array.isArray(obj) ? [...obj] : { ...obj })
    : obj;

  const path = ctx.path;
  path.push('<temp>');

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      path[path.length - 1] = i;
      serdesRecord(i, obj, ctx, fns);
    }
  } else {
    for (const key of Object.keys(obj)) {
      path[path.length - 1] = key;
      serdesRecord(key, obj, ctx, fns);
    }
  }

  path.pop();
  return obj;
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
