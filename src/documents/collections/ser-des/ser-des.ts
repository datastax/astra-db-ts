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

import { BaseSerDesConfig, SerDes, SerDesFn } from '@/src/lib/api/ser-des/ser-des';
import { BaseDesCtx, BaseSerCtx, CONTINUE } from '@/src/lib/api/ser-des/ctx';
import { CollCodecs, RawCollCodecs } from '@/src/documents/collections/ser-des/codecs';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';
import { isBigNumber, pathMatches } from '@/src/lib/utils';
import { CollNumRepCfg, GetCollNumRepFn } from '@/src/documents';
import { coerceBigNumber, coerceNumber, collNumRepFnFromCfg } from '@/src/documents/collections/ser-des/big-nums';

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
export interface CollectionSerDesConfig extends BaseSerDesConfig<CollSerCtx, CollDesCtx> {
  enableBigNumbers?: GetCollNumRepFn | CollNumRepCfg,
  codecs?: RawCollCodecs[],
}

/**
 * @internal
 */
export class CollectionSerDes extends SerDes<CollSerCtx, CollDesCtx> {
  declare protected readonly _cfg: CollectionSerDesConfig & { enableBigNumbers?: GetCollNumRepFn };
  private readonly _getNumRepForPath: GetCollNumRepFn | undefined;

  public constructor(cfg?: CollectionSerDesConfig) {
    super(CollectionSerDes.mergeConfig(DefaultCollectionSerDesCfg, cfg, cfg?.enableBigNumbers ? BigNumCollectionDesCfg : {}));

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

  public static mergeConfig(...cfg: (CollectionSerDesConfig | undefined)[]): CollectionSerDesConfig {
    return {
      enableBigNumbers: cfg.reduce<CollectionSerDesConfig['enableBigNumbers']>((acc, c) => c?.enableBigNumbers ?? acc, undefined),
      ...super._mergeConfig(...cfg),
    };
  }
}

const BigNumCollectionDesCfg: CollectionSerDesConfig = {
  deserialize(value, ctx) {
    if (typeof value === 'number') {
      return coerceNumber(value, ctx);
    }

    if (isBigNumber(value)) {
      return coerceBigNumber(value, ctx);
    }

    return ctx.nevermind();
  },
};

const DefaultCollectionSerDesCfg: CollectionSerDesConfig = {
  serialize(value, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    // Path-based serializers
    for (const pathSer of ctx.serializers.forPath[ctx.path.length] ?? []) {
      if (pathMatches(pathSer.path, ctx.path) && pathSer.fns.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== CONTINUE; })) {
        return resp;
      }
    }

    // Name-based serializers
    const key = ctx.path[ctx.path.length - 1] ?? '';
    const nameSer = ctx.serializers.forName[key];

    if (nameSer && nameSer.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== CONTINUE; })) {
      return resp;
    }

    // Type-based & custom serializers
    for (const guardSer of ctx.serializers.forGuard) {
      if (guardSer.guard(value, ctx)) {
        const resp = guardSer.fn(value, ctx);
        (resp.length === 2) && (value = resp[1]);

        if (resp[0] !== CONTINUE) {
          return resp;
        }
      }
    }

    if (typeof value === 'object' && value !== null) {
      // Delegate serializer
      if ($SerializeForCollection in value && (resp = value[$SerializeForCollection](ctx))[0] !== CONTINUE) {
        return resp;
      }

      // Class-based serializers
      const classSer = ctx.serializers.forClass.find((c) => value instanceof c.class);

      if (classSer && classSer.fns.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== CONTINUE; })) {
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

    return ctx.recurse(value);
  },
  deserialize(value, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    // Path-based deserializers
    for (const pathDes of ctx.deserializers.forPath[ctx.path.length] ?? []) {
      if (pathMatches(pathDes.path, ctx.path) && pathDes.fns.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== CONTINUE; })) {
        return resp;
      }
    }

    // Name-based deserializers
    const key = ctx.path[ctx.path.length - 1] ?? '';
    const nameDes = ctx.deserializers.forName[key];

    if (nameDes && nameDes.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== CONTINUE; })) {
      return resp;
    }

    // Custom deserializers
    for (const guardDes of ctx.deserializers.forGuard) {
      if (guardDes.guard(value, ctx)) {
        const resp = guardDes.fn(value, ctx);
        (resp.length === 2) && (value = resp[1]);

        if (resp[0] !== CONTINUE) {
          return resp;
        }
      }
    }

    if (typeof value === 'object' && value !== null) {
      // Type-based deserializers
      const keys = Object.keys(value);

      if (keys.length === 1) {
        const typeDes = ctx.deserializers.forType[keys[0]];

        if (typeDes && typeDes.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== CONTINUE; })) {
          return resp;
        }
      }

      // Insurance
      if (isBigNumber(value)) {
        return ctx.done(value);
      }
    }

    return ctx.recurse(value);
  },
  codecs: Object.values(CollCodecs.Defaults),
};
