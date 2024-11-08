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

import { ObjectId, SomeDoc, UUID } from '@/src/documents';
import { DataAPIDesCtx, DataAPISerCtx, mkSerDes } from '@/src/lib/api/ser-des';
import { OneOrMany } from '@/src/lib/types';
import { toArray } from '@/src/lib/utils';
import { DataAPIVector } from '@/src/documents/datatypes/vector';

export const $SerializeForCollection = Symbol.for('astra-db-ts.serialize.collection');

export interface CollectionSerDesConfig<Schema extends SomeDoc> {
  serialize?: OneOrMany<(this: SomeDoc, key: string, value: any, ctx: DataAPISerCtx<Schema>) => [any, boolean?] | boolean | undefined | void>,
  deserialize?: OneOrMany<(this: SomeDoc, key: string, value: any, ctx: DataAPIDesCtx) => [any, boolean?] | boolean | undefined | void>,
  enableBigNumbers?: boolean,
  mutateInPlace?: boolean,
}

/**
 * @internal
 */
export const mkCollectionSerDes = <Schema extends SomeDoc>(cfg: CollectionSerDesConfig<Schema> | undefined) => mkSerDes({
  serializer: [...toArray(cfg?.serialize ?? []), DefaultCollectionSerDesCfg.serialize],
  deserializer: [...toArray(cfg?.deserialize ?? []), DefaultCollectionSerDesCfg.deserialize],
  adaptSerCtx: (ctx) => ctx,
  adaptDesCtx: (ctx) => ctx,
  bigNumsPresent: () => !!cfg?.enableBigNumbers,
  mutateInPlace: cfg?.mutateInPlace,
});

const DefaultCollectionSerDesCfg = {
  serialize(key, value) {
    if (typeof value !== 'object' || value === null) {
      return;
    }

    if (value instanceof Date) {
      if (key === '$date') {
        return [value.valueOf(), true];
      } else {
        return [{ $date: value.valueOf() }, true];
      }
    }

    if (key === '$vector' && DataAPIVector.isVectorLike(value)) {
      value = new DataAPIVector(value);
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
    }

    if (value.$objectId) {
      this[key] = new ObjectId(value.$objectId, false);
    }

    if (value.$uuid) {
      this[key] = new UUID(value.$uuid, false);
    }

    if (key === '$vector') {
      this[key] = new DataAPIVector(value, false);
    }
  },
} satisfies CollectionSerDesConfig<SomeDoc>;
