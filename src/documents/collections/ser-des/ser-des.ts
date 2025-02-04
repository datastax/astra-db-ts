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

import type { BaseSerDesConfig, SerDesFn } from '@/src/lib/api/ser-des/ser-des.js';
import { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import type { BaseDesCtx, BaseSerCtx} from '@/src/lib/api/ser-des/ctx.js';
import { NEVERMIND } from '@/src/lib/api/ser-des/ctx.js';
import type { RawCollCodecs } from '@/src/documents/collections/ser-des/codecs.js';
import { CollCodecs } from '@/src/documents/collections/ser-des/codecs.js';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { isBigNumber, pathMatches } from '@/src/lib/utils.js';
import type { CollNumRepCfg, GetCollNumRepFn } from '@/src/documents/index.js';
import { coerceBigNumber, coerceNumber, collNumRepFnFromCfg } from '@/src/documents/collections/ser-des/big-nums.js';
import { CollSerDesCfgHandler } from '@/src/documents/collections/ser-des/cfg-handler.js';
import type { ParsedSerDesConfig } from '@/src/lib/api/ser-des/cfg-handler.js';

/**
 * @public
 */
export interface CollSerCtx extends BaseSerCtx<CollSerCtx> {
  bigNumsEnabled: boolean,
}

/**
 * @public
 */
export interface CollDesCtx extends BaseDesCtx<CollDesCtx> {
  getNumRepForPath?: GetCollNumRepFn,
}

/**
 * @public
 */
export interface CollSerDesConfig extends BaseSerDesConfig<CollSerCtx, CollDesCtx> {
  enableBigNumbers?: GetCollNumRepFn | CollNumRepCfg,
  codecs?: RawCollCodecs[],
}

/**
 * @internal
 */
export class CollSerDes extends SerDes<CollSerCtx, CollDesCtx> {
  declare protected readonly _cfg: ParsedSerDesConfig<CollSerDesConfig> & { enableBigNumbers?: GetCollNumRepFn };
  private readonly _getNumRepForPath: GetCollNumRepFn | undefined;

  public static cfg: typeof CollSerDesCfgHandler = CollSerDesCfgHandler;

  public constructor(cfg: ParsedSerDesConfig<CollSerDesConfig>) {
    super(CollSerDes.cfg.concat([codecs, cfg]), serialize, deserialize);

    this._getNumRepForPath = (typeof cfg?.enableBigNumbers === 'object')
      ? collNumRepFnFromCfg(cfg.enableBigNumbers)
      : cfg?.enableBigNumbers;
  }

  public override adaptSerCtx(ctx: CollSerCtx): CollSerCtx {
    ctx.bigNumsEnabled = !!this._getNumRepForPath;
    return ctx;
  }

  public override adaptDesCtx(ctx: CollDesCtx): CollDesCtx {
    ctx.getNumRepForPath = this._getNumRepForPath;
    return ctx;
  }

  public override bigNumsPresent(): boolean {
    return !!this._cfg?.enableBigNumbers;
  }
}

const serialize: SerDesFn<CollSerCtx> = (value, ctx) => {
  let resp: ReturnType<SerDesFn<unknown>> = null!;

  // Path-based serializers
  for (const pathSer of ctx.serializers.forPath[ctx.path.length] ?? []) {
    if (pathMatches(pathSer.path, ctx.path) && pathSer.fns.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
      return resp;
    }
  }

  // Name-based serializers
  const key = ctx.path[ctx.path.length - 1] ?? '';
  const nameSer = ctx.serializers.forName[key];

  if (nameSer?.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
    return resp;
  }

  // Type-based & custom serializers
  for (const guardSer of ctx.serializers.forGuard) {
    if (guardSer.guard(value, ctx) && (resp = guardSer.fn(value, ctx))[0] !== NEVERMIND) {
      return resp;
    }
  }

  if (typeof value === 'object' && value !== null) {
    // Delegate serializer
    if (value[$SerializeForCollection] && (resp = value[$SerializeForCollection](ctx))[0] !== NEVERMIND) {
      return resp;
    }

    // Class-based serializers
    const classSer = ctx.serializers.forClass.find((c) => value instanceof c.class);

    if (classSer?.fns.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
      return resp;
    }

    // Readable err messages for big numbers if not enabled
    if (isBigNumber(value)) {
      if (!ctx.bigNumsEnabled) {
        throw new Error('BigNumber serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig');
      }
      return ctx.done();
    }
  }
  else if (typeof value === 'bigint') {
    if (!ctx.bigNumsEnabled) {
      throw new Error('Bigint serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig');
    }
    return ctx.done();
  }

  return ctx.recurse();
};

const deserialize: SerDesFn<CollDesCtx> = (value, ctx) => {
  let resp: ReturnType<SerDesFn<unknown>> = null!;

  if (ctx.getNumRepForPath) {
    if (typeof value === 'number') {
      value = coerceNumber(value, ctx);
    }

    if (isBigNumber(value)) {
      value = coerceBigNumber(value, ctx);
    }
  }

  // Path-based deserializers
  for (const pathDes of ctx.deserializers.forPath[ctx.path.length] ?? []) {
    if (pathMatches(pathDes.path, ctx.path) && pathDes.fns.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
      return resp;
    }
  }

  // Name-based deserializers
  const key = ctx.path[ctx.path.length - 1] ?? '';
  const nameDes = ctx.deserializers.forName[key];

  if (nameDes?.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
    return resp;
  }

  // Custom deserializers
  for (const guardDes of ctx.deserializers.forGuard) {
    if (guardDes.guard(value, ctx) && (resp = guardDes.fn(value, ctx))[0] !== NEVERMIND) {
      return resp;
    }
  }

  if (typeof value === 'object' && value !== null) {
    // Type-based deserializers
    const keys = Object.keys(value);

    if (keys.length === 1) {
      const typeDes = ctx.deserializers.forType[keys[0]];

      if (typeDes?.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
        return resp;
      }
    }

    // Insurance
    if (isBigNumber(value)) {
      return ctx.done(value);
    }
  }

  return ctx.recurse(value);
};

const codecs = CollSerDes.cfg.parse({ codecs: Object.values(CollCodecs.Defaults) });
