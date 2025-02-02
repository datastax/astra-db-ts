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
  processCodecs,
  RawCodec,
  RawDataAPIResponse,
  Serializers,
} from '@/src/lib';
import {
  BaseDesCtx,
  BaseSerCtx,
  BaseSerDesCtx,
  ctxDone,
  ctxNevermind,
  ctxRecurse,
  ctxReplace,
  DONE,
  NEVERMIND,
  REPLACE,
} from '@/src/lib/api/ser-des/ctx';
import { ParsedSerDesConfig } from '@/src/lib/api/ser-des/cfg-handler';

/**
 * @public
 */
export type SerDesFn<Ctx> = (value: any, ctx: Ctx) => SerDesFnRet | 'Return ctx.done(val?), ctx.recurse(val?), or ctx.continue(val?)';

/**
 * @public
 */
export type SerDesFnRet = readonly [0 | 1 | 2 | 3, any?];

/**
 * @public
 */
export interface BaseSerDesConfig<SerCtx extends BaseSerCtx<any>, DesCtx extends BaseDesCtx<any>> {
  codecs?: (readonly RawCodec<SerCtx, DesCtx>[])[],
  mutateInPlace?: boolean,
  keyTransformer?: KeyTransformer,
}

/**
 * @internal
 */
export abstract class SerDes<SerCtx extends BaseSerCtx<any> = any, DesCtx extends BaseDesCtx<any> = any> {
  private readonly _serializers: Serializers<SerCtx>;
  private readonly _deserializers: Deserializers<DesCtx>;

  protected constructor(
    protected readonly _cfg: ParsedSerDesConfig<BaseSerDesConfig<SerCtx, DesCtx>>,
    private readonly _serialize: SerDesFn<SerCtx>,
    private readonly _deserialize: SerDesFn<DesCtx>,
  ) {
    [this._serializers, this._deserializers] = processCodecs(this._cfg.codecs.flat());
  }

  public serialize(obj: unknown): [unknown, boolean] {
    if (obj === null || obj === undefined) {
      return [obj, false];
    }

    const ctx = this.adaptSerCtx(this._mkCtx(obj, {
      mutatingInPlace: this._cfg.mutateInPlace === true,
      serializers: this._serializers,
    }));

    const serialized = serdesRecord('', { ['']: ctx.rootObj }, ctx, this._serialize)[''];

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

    return serdesRecord('', rootObj, ctx, this._deserialize)[''] as S;
  }

  protected abstract adaptSerCtx(ctx: BaseSerCtx<SerCtx>): SerCtx;
  protected abstract adaptDesCtx(ctx: BaseDesCtx<DesCtx>): DesCtx;
  protected abstract bigNumsPresent(ctx: SerCtx): boolean;

  private _mkCtx<Ctx>(obj: unknown, ctx: Ctx): Ctx & BaseSerDesCtx {
    return {
      done: ctxDone,
      recurse: ctxRecurse,
      nevermind: ctxNevermind,
      replace: ctxReplace,
      keyTransformer: this._cfg.keyTransformer,
      mutatingInPlace: true,
      mapAfter: null!,
      rootObj: obj,
      path: [],
      locals: {},
      ...ctx,
    };
  }
}

function serdesRecord<Ctx extends BaseSerDesCtx>(key: string | number, obj: SomeDoc, ctx: Ctx, fn: SerDesFn<Ctx>) {
  const postMaps: ((v: any) => unknown)[] = [];
  ctx.mapAfter = (fn) => { postMaps.push(fn); return [NEVERMIND]; };

  const stop = applySerdesFn(fn, key, obj, ctx);

  // console.log(ctx.path, obj);

  if (ctx.path.length >= 250) {
    throw new Error('Tried to ser/des a document with a depth of over 250. Did you accidentally create a circular reference?');
  }

  if (!stop && typeof obj[key] === 'object' && obj[key] !== null) {
    obj[key] = serdesRecordHelper(obj[key], ctx, fn);
  }

  for (let i = postMaps.length - 1; i >= 0; i--) {
    obj[key] = postMaps[i](obj[key]);
  }
  return obj;
}

function serdesRecordHelper<Ctx extends BaseSerDesCtx>(obj: SomeDoc, ctx: Ctx, fn: SerDesFn<Ctx>) {
  obj = (!ctx.mutatingInPlace)
    ? (Array.isArray(obj) ? [...obj] : { ...obj })
    : obj;

  const path = ctx.path;
  path.push('<temp>');

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      path[path.length - 1] = i;
      serdesRecord(i, obj, ctx, fn);
    }
  } else {
    for (const key of Object.keys(obj)) {
      path[path.length - 1] = key;
      serdesRecord(key, obj, ctx, fn);
    }
  }

  path.pop();
  return obj;
}

function applySerdesFn<Ctx>(fn: SerDesFn<Ctx>, key: string | number, obj: SomeDoc, ctx: Ctx): boolean {
  let res: ReturnType<SerDesFn<unknown>> = null!;
  let loops = 0;

  do {
    res = fn(obj[key], ctx);

    if (res.length === 2) {
      obj[key] = res[1];
    }

    if (loops++ > 1000) {
      throw new Error('Potential infinite loop caused by ctx.replaces detected (>1000 iterations)');
    }
  } while (res[0] === REPLACE);

  return res[0] === DONE;
}
