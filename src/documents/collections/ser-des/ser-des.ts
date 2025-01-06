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

import { BaseSerDesConfig, SerDes } from '@/src/lib/api/ser-des/ser-des';
import { BaseDesCtx, BaseSerCtx, CONTINUE } from '@/src/lib/api/ser-des/ctx';
import { CollCodecs, CollCodecSerDesFns } from '@/src/documents/collections/ser-des/codecs';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';
import { isBigNumber, stringArraysEqual } from '@/src/lib/utils';
import { CollNumRepCfg, GetCollNumRepFn } from '@/src/documents';
import BigNumber from 'bignumber.js';
import { collNumRepFnFromCfg, NumCoercionError } from '@/src/documents/collections/ser-des/big-nums';

/**
 * @public
 */
export interface CollSerCtx extends BaseSerCtx<CollCodecSerDesFns> {
  bigNumsEnabled: boolean,
}

/**
 * @public
 */
export interface CollDesCtx extends BaseDesCtx<CollCodecSerDesFns> {
  getNumRepForPath?: GetCollNumRepFn,
}

/**
 * @public
 */
export interface CollectionSerDesConfig extends BaseSerDesConfig<CollCodecSerDesFns, CollSerCtx, CollDesCtx> {
  enableBigNumbers?: GetCollNumRepFn | CollNumRepCfg,
}

/**
 * @internal
 */
export class CollectionSerDes extends SerDes<CollCodecSerDesFns, CollSerCtx, CollDesCtx> {
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
  deserialize(_, value, ctx) {
    if (isBigNumber(value)) {
      switch (ctx.getNumRepForPath!(ctx.path)) {
        case 'number': {
          const asNum = value.toNumber();

          if (!value.isEqualTo(asNum)) {
            throw new NumCoercionError(ctx.path, value, 'bignumber', 'number');
          }

          return ctx.next(asNum);
        }
        case 'bigint': {
          if (!value.isInteger()) {
            throw new NumCoercionError(ctx.path, value, 'bignumber', 'bigint');
          }
          return ctx.next(BigInt(value.toFixed(0)));
        }
        case 'bignumber':
          return ctx.next(value);
        case 'string':
        case 'number_or_string':
          return ctx.next(value.toString());
      }
    }

    if (typeof value === 'number') {
      switch (ctx.getNumRepForPath!(ctx.path)) {
        case 'bigint': {
          if (!Number.isInteger(value)) {
            throw new NumCoercionError(ctx.path, value, 'number', 'bigint');
          }
          return ctx.next(BigInt(value));
        }
        case 'bignumber':
          return ctx.next(BigNumber(value));
        case 'string':
          return ctx.next(value.toString());
        case 'number':
        case 'number_or_string':
          return ctx.next(value);
      }
    }

    return ctx.continue();
  },
};

const DefaultCollectionSerDesCfg: CollectionSerDesConfig = {
  serialize(key, value, ctx) {
    const codecs = ctx.codecs;
    let resp;

    for (let i = 0, n = codecs.path.length; i < n; i++) {
      const path = codecs.path[i].path;

      if (stringArraysEqual(path, ctx.path)) {
        if ((resp = codecs.path[i].serialize?.(key, value, ctx) ?? ctx.continue())[0] !== CONTINUE) {
          return resp;
        }
      }
    }

    if (key in codecs.name) {
      if ((resp = codecs.name[key].serialize?.(key, value, ctx) ?? ctx.continue())[0] !== CONTINUE) {
        return resp;
      }
    }

    for (const codec of codecs.customGuard) {
      if (codec.serializeGuard(value, ctx)) {
        if ((resp = codec.serialize(key, value, ctx))[0] !== CONTINUE) {
          return resp;
        }
      }
    }

    if (typeof value === 'object' && value !== null) {
      if (value[$SerializeForCollection]) {
        if ((resp = value[$SerializeForCollection](ctx))[0] !== CONTINUE) {
          return resp;
        }
      }

      for (const codec of codecs.classGuard) {
        if (value instanceof codec.serializeClass) {
          if ((resp = codec.serialize(key, value, ctx))[0] !== CONTINUE) {
            return resp;
          }
        }
      }

      if (isBigNumber(value)) {
        if (!ctx.bigNumsEnabled) {
          throw new Error('BigNumber serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig');
        }
        return ctx.done();
      }
    } else if (typeof value === 'bigint') {
      if (!ctx.bigNumsEnabled) {
        throw new Error('BigNumber serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig');
      }
      return ctx.done();
    }

    return ctx.continue();
  },
  deserialize(key, value, ctx) {
    const codecs = ctx.codecs;
    let resp;

    for (let i = 0, n = codecs.path.length; i < n; i++) {
      const path = codecs.path[i].path;

      if (stringArraysEqual(path, ctx.path)) {
        if ((resp = codecs.path[i].deserialize?.(key, value, ctx) ?? ctx.continue())[0] !== CONTINUE) {
          return resp;
        }
      }
    }

    if (key in codecs.name) {
      if ((resp = codecs.name[key].deserialize(key, value, ctx))[0] !== CONTINUE) {
        return resp;
      }
    }

    if (ctx.keys?.length === 1 && ctx.keys[0] in codecs.type) {
      if ((resp = codecs.type[ctx.keys[0]].deserialize?.(key, value, ctx) ?? ctx.continue())[0] !== CONTINUE) {
        return resp;
      }
    }

    if (typeof value === 'object' && isBigNumber(value) || value instanceof Date) {
      return ctx.done(value);
    }

    return ctx.continue();
  },
  codecs: Object.values(CollCodecs.Defaults),
};
