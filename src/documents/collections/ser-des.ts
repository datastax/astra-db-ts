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

import { ObjectId, SomeDoc, SomeRow, UUID } from '@/src/documents';
import { DataAPIDesCtx, DataAPISerCtx, DataAPISerDes, DataAPISerDesConfig } from '@/src/lib/api/ser-des';
import { DataAPIVector } from '@/src/documents/datatypes/vector';

export const $SerializeForCollection = Symbol.for('astra-db-ts.serialize.collection');

export type CollSerCtx<WSchema extends SomeDoc> = DataAPISerCtx<WSchema>;
export type CollDesCtx = DataAPIDesCtx;

export interface CollectionSerDesConfig<WSchema extends SomeDoc> extends DataAPISerDesConfig<WSchema, CollSerCtx<WSchema>, CollDesCtx> {
  enableBigNumbers?: boolean,
}

/**
 * @internal
 */
export class CollectionSerDes<WSchema extends SomeRow> extends DataAPISerDes<CollSerCtx<WSchema>, CollDesCtx> {
  declare protected readonly _cfg: CollectionSerDesConfig<WSchema>;

  public constructor(cfg?: CollectionSerDesConfig<WSchema>) {
    super(CollectionSerDes.mergeConfig(DefaultCollectionSerDesCfg, cfg));
  }

  public override adaptSerCtx(ctx: CollSerCtx<WSchema>): CollSerCtx<WSchema> {
    return ctx;
  }

  public override adaptDesCtx(ctx: CollDesCtx): CollDesCtx {
    return ctx;
  }

  public override bigNumsPresent(): boolean {
    return this._cfg?.enableBigNumbers === true;
  }

  public static mergeConfig<WSchema extends SomeDoc>(...cfg: (CollectionSerDesConfig<WSchema> | undefined)[]): CollectionSerDesConfig<WSchema> {
    return {
      enableBigNumbers: cfg.reduce<boolean | undefined>((acc, c) => c?.enableBigNumbers ?? acc, undefined),
      ...super._mergeConfig(...cfg),
    };
  }
}

const DefaultCollectionSerDesCfg = {
  serialize(key, value) {
    if (typeof value !== 'object' || value === null) {
      return;
    }

    if (value instanceof Date) {
      return [{ $date: value.valueOf() }, true];
    }

    if (key === '$vector' && DataAPIVector.isVectorLike(value)) {
      value = new DataAPIVector(value, false);
    }

    if ($SerializeForCollection in value) {
      return [value[$SerializeForCollection](), true];
    }
  },
  deserialize(key, value) {
    if (typeof value !== 'object' || value === null || $SerializeForCollection in value || value instanceof Date) {
      return;
    }

    if (value.$date) {
      this[key] = new Date(value.$date);
      return;
    }

    if (value.$objectId) {
      this[key] = new ObjectId(value.$objectId, false);
      return;
    }

    if (value.$uuid) {
      this[key] = new UUID(value.$uuid, false);
      return;
    }

    if (key === '$vector') {
      this[key] = new DataAPIVector(value, false);
    }
  },
} satisfies CollectionSerDesConfig<SomeDoc>;
