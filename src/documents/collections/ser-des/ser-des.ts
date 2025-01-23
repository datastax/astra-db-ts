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
import {
  CollCodecs,
  CollCodecSerDesFns,
  CollDeserializers,
  CollSerializers, processCodecs, RawCollCodec,
} from '@/src/documents/collections/ser-des/codecs';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';
import { isBigNumber, stringArraysEqual } from '@/src/lib/utils';
import { CollNumRepCfg, GetCollNumRepFn } from '@/src/documents';
import { coerceBigNumber, coerceNumber, collNumRepFnFromCfg } from '@/src/documents/collections/ser-des/big-nums';

/**
 * @public
 */
export interface CollSerCtx extends BaseSerCtx<CollCodecSerDesFns> {
  serializers: CollSerializers,
  bigNumsEnabled: boolean,
}

/**
 * @public
 */
export interface CollDesCtx extends BaseDesCtx<CollCodecSerDesFns> {
  getNumRepForPath?: GetCollNumRepFn,
  deserializers: CollDeserializers,
}

/**
 * @public
 */
export interface CollectionSerDesConfig extends BaseSerDesConfig<CollCodecSerDesFns, CollSerCtx, CollDesCtx> {
  enableBigNumbers?: GetCollNumRepFn | CollNumRepCfg,
  codecs?: RawCollCodec[],
}

/**
 * @internal
 */
export class CollectionSerDes extends SerDes<CollCodecSerDesFns, CollSerCtx, CollDesCtx> {
  declare protected readonly _cfg: CollectionSerDesConfig & { enableBigNumbers?: GetCollNumRepFn };
  private readonly _getNumRepForPath: GetCollNumRepFn | undefined;

  private readonly _serializers: CollSerializers;
  private readonly _deserializers: CollDeserializers;

  public constructor(cfg?: CollectionSerDesConfig) {
    super(CollectionSerDes.mergeConfig(DefaultCollectionSerDesCfg, cfg, cfg?.enableBigNumbers ? BigNumCollectionDesCfg : {}));

    this._getNumRepForPath = (typeof cfg?.enableBigNumbers === 'object')
      ? collNumRepFnFromCfg(cfg.enableBigNumbers)
      : cfg?.enableBigNumbers;

    [this._serializers, this._deserializers] = processCodecs(this._cfg.codecs ?? []);
  }

  public override adaptSerCtx(ctx: CollSerCtx): CollSerCtx {
    ctx.bigNumsEnabled = !!this._getNumRepForPath;
    ctx.serializers = this._serializers;
    return ctx;
  }

  public override adaptDesCtx(ctx: CollDesCtx): CollDesCtx {
    ctx.getNumRepForPath = this._getNumRepForPath;
    ctx.deserializers = this._deserializers;
    return ctx;
  }

  public override bigNumsPresent(): boolean {
    return !!this._cfg?.enableBigNumbers;
  }

  public static mergeConfig(...cfg: (CollectionSerDesConfig | undefined)[]): CollectionSerDesConfig {
    return {
      enableBigNumbers: cfg.reduce<CollectionSerDesConfig['enableBigNumbers']>((acc, c) => c?.enableBigNumbers ?? acc, undefined),
      codecs: cfg.reduce<CollectionSerDesConfig['codecs']>((acc, c) => [...c?.codecs ?? [], ...acc!], []),
      ...super._mergeConfig(...cfg),
    };
  }
}

const BigNumCollectionDesCfg: CollectionSerDesConfig = {
  deserialize(_, value, ctx) {
    if (typeof value === 'number') {
      return coerceNumber(value, ctx);
    }

    if (isBigNumber(value)) {
      return coerceBigNumber(value, ctx);
    }

    return ctx.continue();
  },
};

const DefaultCollectionSerDesCfg: CollectionSerDesConfig = {
  serialize(key, value, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    // Path-based serializers
    const pathSer = ctx.serializers.forPath.find((p) => stringArraysEqual(p.path, ctx.path));

    if (pathSer && pathSer.fns.find((ser) => (resp = ser(key, value, ctx))[0] !== CONTINUE)) {
      return resp;
    }

    // Name-based serializers
    const nameSer = ctx.serializers.forName[key];

    if (nameSer && nameSer.find((ser) => (resp = ser(key, value, ctx))[0] !== CONTINUE)) {
      return resp;
    }

    // Type-based/custom serializers
    const guardSer = ctx.serializers.forGuard.find((g) => g.guard(value, ctx));

    if (guardSer && (resp = guardSer.fn(key, value, ctx))[0] !== CONTINUE) {
      return resp;
    }

    if (typeof value === 'object' && value !== null) {
      // Delegate serializer
      if ($SerializeForCollection in value && (resp = value[$SerializeForCollection](ctx))[0] !== CONTINUE) {
        return resp;
      }

      // Class-based serializers
      const classSer = ctx.serializers.forClass.find((c) => value instanceof c.class);

      if (classSer && classSer.fns.find((ser) => (resp = ser(key, value, ctx))[0] !== CONTINUE)) {
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
        throw new Error('BigNumber serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig');
      }
      return ctx.done();
    }

    return ctx.continue();
  },
  deserialize(key, value, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    // Path-based deserializers
    const pathDes = ctx.deserializers.forPath.find((p) => stringArraysEqual(p.path, ctx.path));

    if (pathDes && pathDes.fns.find((des) => (resp = des(key, value, ctx))[0] !== CONTINUE)) {
      return resp;
    }

    // Name-based deserializers
    const nameDes = ctx.deserializers.forName[key];

    if (nameDes && nameDes.find((des) => (resp = des(key, value, ctx))[0] !== CONTINUE)) {
      return resp;
    }

    // Custom deserializers
    const guardDes = ctx.deserializers.forGuard.find((g) => g.guard(value, ctx));

    if (guardDes && (resp = guardDes.fn(key, value, ctx))[0] !== CONTINUE) {
      return resp;
    }

    // Type-based deserializers
    if (ctx.keys?.length === 1) {
      const typeDes = ctx.deserializers.forType[ctx.keys[0]];

      if (typeDes && typeDes.find((des) => (resp = des(key, value, ctx))[0] !== CONTINUE)) {
        return resp;
      }
    }

    // Insurance
    if (typeof value === 'object' && isBigNumber(value) || value instanceof Date) {
      return ctx.done(value);
    }

    return ctx.continue();
  },
  codecs: Object.values(CollCodecs.Defaults),
};
