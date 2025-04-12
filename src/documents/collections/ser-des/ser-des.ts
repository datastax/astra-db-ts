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
import type { BaseDesCtx, BaseSerCtx } from '@/src/lib/api/ser-des/ctx.js';
import { NEVERMIND } from '@/src/lib/api/ser-des/ctx.js';
import type { RawCollCodecs } from '@/src/documents/collections/ser-des/codecs.js';
import { CollectionCodecs } from '@/src/documents/collections/ser-des/codecs.js';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { isBigNumber } from '@/src/lib/utils.js';
import type { CollNumCoercionCfg, GetCollNumCoercionFn } from '@/src/documents/index.js';
import { buildGetNumCoercionForPathFn, coerceNums } from '@/src/documents/collections/ser-des/big-nums.js';
import { CollSerDesCfgHandler } from '@/src/documents/collections/ser-des/cfg-handler.js';
import type { ParsedSerDesConfig } from '@/src/lib/api/ser-des/cfg-handler.js';
import { pathMatches } from '@/src/lib/api/ser-des/utils.js';

/**
 * @beta
 */
export interface CollectionSerCtx extends BaseSerCtx<CollectionSerCtx> {
  bigNumsEnabled: boolean,
}

/**
 * @beta
 */
export interface CollectionDesCtx extends BaseDesCtx<CollectionDesCtx> {
  getNumCoercionForPath?: GetCollNumCoercionFn,
}

/**
 * @beta
 */
export interface CollectionSerDesConfig extends BaseSerDesConfig<CollectionSerCtx, CollectionDesCtx> {
  enableBigNumbers?: GetCollNumCoercionFn | CollNumCoercionCfg,
  codecs?: RawCollCodecs[],
}

/**
 * @internal
 */
export class CollSerDes extends SerDes<CollectionSerCtx, CollectionDesCtx> {
  declare protected readonly _cfg: ParsedSerDesConfig<CollectionSerDesConfig> & { enableBigNumbers?: GetCollNumCoercionFn };
  private readonly _getNumCoercionForPath: GetCollNumCoercionFn | undefined;

  public static cfg: typeof CollSerDesCfgHandler = CollSerDesCfgHandler;

  public constructor(cfg: ParsedSerDesConfig<CollectionSerDesConfig>) {
    super(CollSerDes.cfg.concat([codecs, cfg]), serialize, deserialize);
    this._getNumCoercionForPath = buildGetNumCoercionForPathFn(cfg);
  }

  public override adaptSerCtx(ctx: CollectionSerCtx): CollectionSerCtx {
    ctx.bigNumsEnabled = !!this._getNumCoercionForPath;
    return ctx;
  }

  public override adaptDesCtx(ctx: CollectionDesCtx): CollectionDesCtx {
    ctx.getNumCoercionForPath = this._getNumCoercionForPath;

    if (ctx.getNumCoercionForPath) {
      ctx.rootObj = coerceNums(ctx.rootObj, ctx.getNumCoercionForPath);
    }

    return ctx;
  }

  public override bigNumsPresent(): boolean {
    return !!this._cfg?.enableBigNumbers;
  }
}

const serialize: SerDesFn<CollectionSerCtx> = (value, ctx) => {
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
      throw new Error('BigInt serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig');
    }
    return ctx.done();
  }

  return ctx.recurse();
};

const deserialize: SerDesFn<CollectionDesCtx> = (value, ctx) => {
  let resp: ReturnType<SerDesFn<unknown>> = null!;

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

const codecs = CollSerDes.cfg.parse({ codecs: Object.values(CollectionCodecs.Defaults) });
