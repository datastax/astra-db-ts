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

import { ObjectId, UUID } from '@/src/documents/datatypes';
import type { SomeDoc, SomeRow } from '@/src/documents';
import type { ListTableColumnDefinitions } from '@/src/db';
import type { RawDataAPIResponse } from '@/src/lib';

export interface DataAPISerCtx<Schema extends SomeDoc> {
  rootObj: Schema,
}

export interface DataAPIDesCtx {
  rootObj: SomeDoc,
  rawDataApiResp: RawDataAPIResponse,
}

export type DataAPISerFn<Ctx> = (this: Readonly<SomeDoc>, key: string, value: any, ctx: Ctx) => [any, boolean?] | undefined;
export type DataAPIDesFn<Ctx> = (this: SomeDoc, key: string, value: any, ctx: Ctx) => void;

export type DataAPISerFns<Ctx> = [client: DataAPISerFn<Ctx>, user?: DataAPISerFn<Ctx>];
export type DataAPIDesFns<Ctx> = [client: DataAPIDesFn<Ctx>, user?: DataAPIDesFn<Ctx>];

export interface DataAPISerDes<Schema extends SomeDoc, SerCtx extends DataAPISerCtx<Schema>, DesCtx extends DataAPIDesCtx> {
  serializer: DataAPISerFns<SerCtx>,
  deserializer: DataAPIDesFns<DesCtx>,
  adaptSerCtx: (ctx: DataAPISerCtx<Schema>) => SerCtx,
  adaptDesCtx: (ctx: DataAPIDesCtx) => DesCtx,
}

export interface TableSerDes<Schema extends SomeRow> {
  serialize: DataAPISerFn<DataAPISerCtx<Schema>>,
  deserialize: DataAPIDesFn<DataAPIDesCtx & { tableSchema: ListTableColumnDefinitions }>,
}

export interface CollectionSerDes<Schema extends SomeDoc> {
  serialize: DataAPISerFn<DataAPISerCtx<Schema>>,
  deserialize: DataAPIDesFn<DataAPIDesCtx>,
}

export const CollectionSerDes: CollectionSerDes<SomeDoc> = {
  serialize(key, value) {
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return [{ $date: this[key].valueOf() }, false];
      }

      if (value instanceof ObjectId) {
        return [{ $objectId: value.toString() }, false];
      }

      if (value instanceof UUID) {
        return [{ $uuid: value.toString() }, false];
      }
    }

    return undefined;
  },
  deserialize(key, value) {
    if (typeof value === 'object') {
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

export const serializeObject = <Ctx>(obj: SomeDoc, maxDepth: number, ctx: Ctx, fns: DataAPISerFns<Ctx>) => {
  let ret = obj;

  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];
    const value = obj[key];
    let recurse;

    const replacement1 = fns[0].call(obj, key, value, ctx);

    if (replacement1 !== undefined) {
      if (ret === obj) {
        ret = { ...obj };
      }
      ret[key] = replacement1[0];
      recurse = replacement1[1];
    } else {
      const replacement2 = fns[1]?.call(obj, key, value, ctx);

      if (replacement2 !== undefined) {
        if (ret === obj) {
          ret = { ...obj };
        }
        ret[key] = replacement2;
        recurse = false;
      }
    }

    if (recurse && maxDepth > 0 && typeof ret[key] === 'object') {
      ret[key] = serializeObject(value, maxDepth - 1, ctx, fns);
    }
  }

  return ret;
};

export const deserializeObject = <Ctx>(obj: SomeDoc, maxDepth: number, ctx: Ctx, fns: DataAPIDesFns<Ctx>) => {
  for (let keys = Object.keys(obj), i = keys.length; i--;) {
    const key = keys[i];

    fns[0].call(obj, key, obj[key], ctx);
    fns[1]?.call(obj, key, obj[key], ctx);

    if (maxDepth > 0 && typeof obj[key] === 'object') {
      deserializeObject(obj[key], maxDepth - 1, ctx, fns);
    }
  }
};
