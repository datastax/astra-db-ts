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

import { SerDes, SerDesConfig } from '@/src/lib/api/ser-des/ser-des';
import { BaseDesCtx, BaseSerCtx } from '@/src/lib/api/ser-des/ctx';
import { CollCodecs, CollCodecSerDesFns } from '@/src/documents/collections/ser-des/codecs';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';

export type CollSerCtx = BaseSerCtx<CollCodecSerDesFns>
export type CollDesCtx = BaseDesCtx<CollCodecSerDesFns>

export interface CollectionSerDesConfig extends SerDesConfig<CollCodecs, CollCodecSerDesFns, CollSerCtx, CollDesCtx> {
  enableBigNumbers?: boolean,
  codecs?: CollCodecs[],
}

/**
 * @internal
 */
export class CollectionSerDes extends SerDes<CollCodecSerDesFns, CollSerCtx, CollDesCtx> {
  declare protected readonly _cfg: CollectionSerDesConfig;

  public constructor(cfg?: CollectionSerDesConfig) {
    super(CollectionSerDes.mergeConfig(DefaultCollectionSerDesCfg, cfg));
  }

  public override adaptSerCtx(ctx: CollSerCtx): CollSerCtx {
    return ctx;
  }

  public override adaptDesCtx(ctx: CollDesCtx): CollDesCtx {
    return ctx;
  }

  public override bigNumsPresent(): boolean {
    return this._cfg?.enableBigNumbers === true;
  }

  public static mergeConfig(...cfg: (CollectionSerDesConfig | undefined)[]): CollectionSerDesConfig {
    return {
      enableBigNumbers: cfg.reduce<boolean | undefined>((acc, c) => c?.enableBigNumbers ?? acc, undefined),
      ...super._mergeConfig(...cfg),
    };
  }
}

const DefaultCollectionSerDesCfg = {
  serialize(key, value, ctx) {
    if (key in ctx.nameCodecs) {
      return ctx.nameCodecs[key].serialize?.(key, value, ctx) ?? true;
    }

    if (typeof value === 'object' && value !== null) {
      if (value[$SerializeForCollection]) {
        return value[$SerializeForCollection](ctx);
      }

      for (const codec of ctx.classGuardCodecs) {
        if (value instanceof codec.serializeClass) {
          return codec.serialize(key, value, ctx);
        }
      }
    }

    for (const codec of ctx.customGuardCodecs) {
      if (codec.serializeGuard(value, ctx)) {
        return codec.serialize(key, value, ctx);
      }
    }
  },
  deserialize(key, value, ctx) {
    if (key in ctx.nameCodecs) {
      return ctx.nameCodecs[key].deserialize(key, value, ctx);
    }

    if (ctx.keys?.length === 1 && (ctx.keys[0] in ctx.typeCodecs)) {
      return ctx.typeCodecs[ctx.keys[0]].deserialize!(key, value, ctx);
    }
  },
  codecs: Object.values(CollCodecs.Defaults),
} satisfies CollectionSerDesConfig;
