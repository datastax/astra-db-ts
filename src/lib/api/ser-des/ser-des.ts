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

import type { SomeDoc } from '@/src/documents/index.js';
import type { Deserializers, RawCodec, RawDataAPIResponse, Serializers } from '@/src/lib/index.js';
import type { BaseDesCtx, BaseSerCtx, BaseSerDesCtx } from '@/src/lib/api/ser-des/ctx.js';
import {
  ctxDone,
  ctxNevermind,
  ctxRecurse,
  ctxReplace,
  DONE,
  NEVERMIND,
  REPLACE,
  SerDesTarget,
} from '@/src/lib/api/ser-des/ctx.js';
import type { ParsedSerDesConfig } from '@/src/lib/api/ser-des/cfg-handler.js';
import type { PathSegment } from '@/src/lib/types.js';
import { processCodecs } from '@/src/lib/api/ser-des/codecs.js';

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
  /**
   * ##### Overview (Alpha)
   *
   * Provides a structured interface for integrating custom serialization/deserialization logic for documents/rows, filters, ids, etc.
   *
   * You may create implementations of these codecs through the {@link TableCodecs} and {@link CollectionCodecs} classes.
   *
   * See {@link TableSerDesConfig.codecs} & {@link CollectionSerDesConfig.codecs} for much more information.
   *
   * ##### Disclaimer
   *
   * Codecs are a powerful feature, but should be used with caution. It's possible to break the client's behavior by using the features incorrectly.
   *
   * Always test your codecs with a variety of documents to ensure that they behave as expected, before using them on real data.
   *
   * @alpha
   */
  codecs?: (readonly RawCodec<SerCtx, DesCtx>[])[],
  /**
   * ##### Overview
   *
   * Enables an optimization which allows inserted rows/documents to be mutated in-place when serializing.
   *
   * The feature is stable; however, the state of any document after being serialized is not guaranteed.
   *
   * This will mutate filters and update filters as well.
   *
   * ##### Context
   *
   * For example, when you insert a record like so:
   * ```ts
   * import { uuid } from '@datastax/astra-db-ts';
   * await collection.insertOne({ name: 'Alice', friends: { john: uuid('...') } });
   * ```
   *
   * The document is internally serialized as such:
   * ```ts
   * { name: 'Alice', friends: { john: { $uuid: '...' } } }
   * ```
   *
   * To avoid mutating a user-provided object, the client will be forced to clone any objects that contain
   * a custom datatype, as well as their parents (which looks something like this):
   * ```ts
   * { ...original, friends: { ...original.friends, john: { $uuid: '...' } } }
   * ```
   *
   * ##### Enabling this option
   *
   * This can be a minor performance hit, especially for large objects, so if you're confident that you won't be
   * needing the object after it's inserted, you can enable this option to avoid the cloning, and instead mutate
   * the object in-place.
   *
   * @example
   * ```ts
   * // Before
   * const collection = db.collection<User>('users');
   *
   * const doc = { name: 'Alice', friends: { john: uuid.v4() } };
   * await collection.insertOne(doc);
   *
   * console.log(doc); // { name: 'Alice', friends: { john: UUID<4>('...') } }
   *
   * // After
   * const collection = db.collection<User>('users', {
   *   serdes: { mutateInPlace: true },
   * });
   *
   * const doc = { name: 'Alice', friends: { john: UUID.v4() } };
   * await collection.insertOne(doc);
   *
   * console.log(doc); // { name: 'Alice', friends: { john: { $uuid: '...' } } }
   * ```
   *
   * @defaultValue false
   */
  mutateInPlace?: boolean,
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

  public serialize(obj: unknown, target: SerDesTarget = SerDesTarget.Record): [unknown, boolean] {
    if (obj === null || obj === undefined) {
      return [obj, false];
    }

    const ctx = this.adaptSerCtx(this._mkCtx(obj, target, {
      mutatingInPlace: this._cfg.mutateInPlace === true,
      serializers: this._serializers,
    }));

    const serialized = serdesRecord('', { ['']: ctx.rootObj }, ctx, this._serialize)[''];

    return [serialized, this.bigNumsPresent(ctx)];
  }

  public deserialize<S>(obj: unknown, raw: RawDataAPIResponse, target: SerDesTarget = SerDesTarget.Record): S {
    if (obj === null || obj === undefined) {
      return obj as S;
    }

    const ctx = this.adaptDesCtx(this._mkCtx(obj, target, {
      deserializers: this._deserializers,
      rawDataApiResp: raw,
    }));

    return serdesRecord('',  { ['']: ctx.rootObj }, ctx, this._deserialize)[''] as S;
  }

  protected abstract adaptSerCtx(ctx: BaseSerCtx<SerCtx>): SerCtx;
  protected abstract adaptDesCtx(ctx: BaseDesCtx<DesCtx>): DesCtx;
  protected abstract bigNumsPresent(ctx: SerCtx): boolean;

  private _mkCtx<Ctx>(obj: unknown, target: SerDesTarget, ctx: Ctx): Ctx & BaseSerDesCtx {
    return {
      done: ctxDone,
      recurse: ctxRecurse,
      nevermind: ctxNevermind,
      replace: ctxReplace,
      mutatingInPlace: true,
      mapAfter: null!,
      target: target,
      rootObj: obj,
      path: [],
      locals: {},
      ...ctx,
    };
  }
}

function serdesRecord<Ctx extends BaseSerDesCtx>(key: PathSegment, obj: SomeDoc, ctx: Ctx, fn: SerDesFn<Ctx>) {
  const postMaps: ((v: any) => unknown)[] = [];
  ctx.mapAfter = (fn) => { postMaps.push(fn); return [NEVERMIND]; };

  const stop = applySerdesFn(fn, key, obj, ctx);

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

function applySerdesFn<Ctx>(fn: SerDesFn<Ctx>, key: PathSegment, obj: SomeDoc, ctx: Ctx): boolean {
  let res: ReturnType<SerDesFn<unknown>> = null!;
  let loops = 0;

  do {
    res = fn(obj[key], ctx);

    if (res.length === 2) {
      obj[key] = res[1];
    }

    if (loops++ > 250) {
      throw new Error('Potential infinite loop caused by ctx.replaces detected (>250 iterations)');
    }
  } while (res[0] === REPLACE);

  return res[0] === DONE;
}
