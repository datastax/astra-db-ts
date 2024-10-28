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

import { CqlDate, CqlDuration, CqlTime, CqlTimestamp, InetAddress, SomeRow, UUID } from '@/src/documents';
import {
  $SerializeRelaxed,
  DataAPIDesCtx,
  DataAPIDesFn,
  DataAPISerCtx,
  DataAPISerFn,
  mkSerDes,
} from '@/src/lib/api/ser-des';
import {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
  TableScalarType,
} from '@/src/db';

type TableDesCtx = DataAPIDesCtx & { tableSchema: ListTableColumnDefinitions, parsers: Record<string, TableColumnTypeParser> };

export type TableColumnTypeParser = (val: any, ctx: TableDesCtx, v?: TableScalarType, k?: TableScalarType) => any;

export interface TableSerDesConfig<Schema extends SomeRow> {
  serialize?: DataAPISerFn<DataAPISerCtx<Schema>>,
  deserialize?: DataAPIDesFn<TableDesCtx>,
  parsers?: Record<string, TableColumnTypeParser>,
  mutateInPlace?: boolean,
}

export const mkTableSerDes = <Schema extends SomeRow>(cfg?: TableSerDesConfig<Schema>) => {
  const parsers = { ...DefaultTableSerDes.parsers, ...cfg?.parsers };

  return mkSerDes({
    serializer: [cfg?.serialize, DefaultTableSerDes.serialize].filter(x => x).map(x => x!),
    deserializer: [cfg?.deserialize, DefaultTableSerDes.deserialize].filter(x => x).map(x => x!),
    adaptSerCtx: (ctx: DataAPISerCtx<Schema>) => ctx,
    adaptDesCtx: (_ctx) => {
      const ctx = _ctx as TableDesCtx;
      ctx.tableSchema = ctx.rawDataApiResp.status?.primaryKeySchema ?? ctx.rawDataApiResp.status!.projectionSchema;
      ctx.parsers = parsers;
      return ctx;
    },
    mutateInPlace: cfg?.mutateInPlace,
  });
};

export const DefaultTableSerDes: Omit<Required<TableSerDesConfig<SomeRow>>, 'mutateInPlace'> = {
  serialize(_, value) {
    if (typeof value === 'object') {
      if ($SerializeRelaxed in value) {
        return [value[$SerializeRelaxed](), false];
      }

      if (value instanceof Map) {
        return [Object.fromEntries(value)];
      }

      if (value instanceof Set) {
        return [[...value]];
      }
    }
    return undefined;
  },
  deserialize(key, _, ctx) {
    if (this === ctx.rootObj) {
      deserializeObj(ctx, ctx.rootObj[key], key, ctx.tableSchema[key]);
    }
    return true;
  },
  parsers: {
    date: (date) => new CqlDate(date),
    duration: (duration) => new CqlDuration(duration),
    inet: (inet) => new InetAddress(inet),
    time: (time) => new CqlTime(time),
    timestamp: (timestamp) => new CqlTimestamp(timestamp),
    uuid: (uuid) => new UUID(uuid, false),
    timeuuid: (uuid) => new UUID(uuid, false),
    varint: BigInt,
    map(map, ctx, v, k) {
      const entries = Array.isArray(map) ? map : Object.entries(map);

      for (let i = entries.length; i--;) {
        const [key, value] = entries[i];
        entries[i] = [ctx.parsers[k!] ? ctx.parsers[k!](key, ctx) : key, ctx.parsers[v!] ? ctx.parsers[v!](value, ctx) : value];
      }

      return new Map(entries);
    },
    list(values, ctx, v) {
      for (let i = values.length; i--;) {
        values[i] = ctx.parsers[v!] ? ctx.parsers[v!](values[i], ctx) : values[i];
      }
      return values;
    },
    set(set, ctx, v) {
      return new Set(ctx.parsers.list(set, ctx, v));
    },
  },
};

const deserializeObj = (ctx: TableDesCtx, obj: SomeRow, key: string, column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) => {
  const type = (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;

  const parser = ctx.parsers[type];

  if (parser) {
    obj[key] = parser(obj[key], (<any>column).valueType, (<any>column).keyType);
  }
};
