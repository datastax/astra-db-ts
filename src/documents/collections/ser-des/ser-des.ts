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
import type { CollNumCoercionCfg, CollNumCoercionFn } from '@/src/documents/index.js';
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
  getNumCoercionForPath?: CollNumCoercionFn,
}

/**
 * @beta
 */
export interface CollectionSerDesConfig extends BaseSerDesConfig<CollectionSerCtx, CollectionDesCtx> {
  /**
   * ##### Overview
   *
   * By default, large numbers (such as `bigint` and {@link BigNumber}) are disabled during serialization and deserialization.
   * _This means that attempts to serialize such numbers will result in errors, and they may lose precision during deserialization._
   *
   * To enable big numbers, you may set configure this option to select which numerical type each field is deserialized to.
   *
   * ---
   *
   * ##### Why is this not enabled by default?
   *
   * This errorful behavior exists for two primary reasons:
   * 1. **Performance:** Enabling big numbers necessitates usage of a specialized JSON library which is capable of serializing/deserializing these numbers without loss of precision, which is much slower than the native JSON library.
   *     - Realistically, however, the difference is likely negligible for most cases
   * 2. **Ambiguity in Deserialization:** There is an inherent ambiguity in deciding how to deserialize big numbers, as certain numbers may be representable in various different numerical formats, and not in an easily predictable way.
   *     - For example, `9007199254740992` is equally representable as either a `number`, `bigint`, a `BigNumber`, or even a `string`.
   *
   * Luckily, there is no such ambiguity in serialization, as any number is just a series of digits in JSON.
   *
   * ---
   *
   * ##### Configuring this option
   *
   * Deserialization behavior must be configured to enable big numbers on a collection-by-collection basis.
   *
   * Serialization behavior requires no such configuration, as there is no serialization ambiguity as aforementioned.
   *
   * This option can be configured in two ways:
   * - **As a function**, which takes in the path of the field being deserialized and returns a coercion type.
   *   - See {@link CollNumCoercionFn} for more details.
   * - **As a configuration object**, which allows you to specify the coercion type for any path.
   *   - See {@link CollNumCoercionCfg} for more details.
   *
   * The coercion type itself (a {@link CollNumCoercion}) is either:
   * - A string representing a pre-defined numerical coercion, or
   * - A function which takes in the value and the path of the field being deserialized, and returns the coerced value.
   *
   * See {@link CollNumCoercion} for the different coercion types, and any additional caveats on a per-type basis.
   *
   * ---
   *
   * ##### Examples
   *
   * The following example uses `bigint` for monetary fields, and `number`s for all other fields.
   *
   * **It's heavily recommended that you read the documentation for {@link CollNumCoercion} to understand the implications of each coercion type.**
   *
   * @example
   * ```ts
   * interface Order {
   *   discount: bigint,
   *   statusCode: number,
   *   items: {
   *     productID: UUID,
   *     quantity: number,
   *     price: BigNumber,
   *   }[],
   * }
   *
   * const orders = db.collection<Order>('orders', {
   *   serdes: {
   *     enableBigNumbers: {
   *       '*': 'number',
   *       'discount': 'bigint',
   *       'items.*.price': 'bignumber',
   *     },
   *   },
   * });
   *
   * const { insertedId } = await orders.insertOne({
   *   discount: 123n,
   *   statusCode: 1,
   *   items: [
   *     {
   *       productID: uuid.v4(),
   *       quantity: 2,
   *       price: BigNumber(100),
   *     },
   *   ],
   * });
   *
   * const order = await orders.findOne({ _id: insertedId });
   *
   * console.log(order.discount); // 123n
   * console.log(order.statusCode); // 1
   * console.log(order.items[0].price); // BigNumber(100)
   * ```
   *
   * @see CollNumCoercionFn
   * @see CollNumCoercionCfg
   * @see CollNumCoercion
   */
  enableBigNumbers?: CollNumCoercionFn | CollNumCoercionCfg,
  codecs?: RawCollCodecs[],
}

/**
 * @internal
 */
export class CollSerDes extends SerDes<CollectionSerCtx, CollectionDesCtx> {
  declare protected readonly _cfg: ParsedSerDesConfig<CollectionSerDesConfig> & { enableBigNumbers?: CollNumCoercionFn };
  private readonly _getNumCoercionForPath: CollNumCoercionFn | undefined;

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
