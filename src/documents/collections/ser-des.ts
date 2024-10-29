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
import { $SerializeStrict, DataAPIDesCtx, DataAPISerCtx, mkSerDes } from '@/src/lib/api/ser-des';

export interface CollectionSerDesConfig<Schema extends SomeDoc> {
  serialize?: (this: SomeDoc, key: string, value: any, ctx: DataAPISerCtx<Schema>) => [any, boolean?] | boolean | undefined | void,
  deserialize?: (this: SomeDoc, key: string, value: any, ctx: DataAPIDesCtx) => [any, boolean?] | boolean | undefined | void,
  mutateInPlace?: boolean,
}

export const mkCollectionSerDes = <Schema extends SomeDoc>(cfg?: CollectionSerDesConfig<Schema>) => mkSerDes({
  serializer: [cfg?.serialize, DefaultCollectionSerDesCfg.serialize].filter(x => x).map(x => x!),
  deserializer: [cfg?.deserialize, DefaultCollectionSerDesCfg.deserialize].filter(x => x).map(x => x!),
  adaptSerCtx: (ctx) => ctx,
  adaptDesCtx: (ctx) => ctx,
  mutateInPlace: cfg?.mutateInPlace,
});

const DefaultCollectionSerDesCfg: CollectionSerDesConfig<SomeDoc> = {
  serialize(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (value instanceof Date) {
        if (key === '$date') {
          return [value.valueOf(), true];
        } else {
          return [{ $date: value.valueOf() }, true];
        }
      }

      if ($SerializeStrict in value) {
        return [value[$SerializeStrict](), true];
      }
    }
  },
  deserialize(key, value) {
    if (typeof value === 'object' && value !== null) {
      if ($SerializeStrict in value || value instanceof Date) {
        return;
      }

      if (value.$date) {
        this[key] = new Date(value.$date);
      }

      if (value.$objectId) {
        this[key] = new ObjectId(value.$objectId);
      }

      if (value.$uuid) {
        this[key] = new UUID(value.$uuid);
      }
    }
  },
};
