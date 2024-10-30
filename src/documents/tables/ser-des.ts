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

import {
  CqlBlob,
  CqlDate,
  CqlDuration,
  CqlTime,
  CqlTimestamp,
  InetAddress,
  SomeDoc,
  SomeRow,
  UUID,
} from '@/src/documents';
import { DataAPIDesCtx, DataAPISerCtx, mkSerDes } from '@/src/lib/api/ser-des';
import {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
} from '@/src/db';
import { OneOrMany } from '@/src/lib/types';
import { toArray } from '@/src/lib/utils';
import { DataAPIVector } from '@/src/documents/datatypes/vector';

export const $SerializeForTables = Symbol.for('astra-db-ts.serialize.table');
export const $DeserializeForTables = Symbol.for('astra-db-ts.deserialize.table');

export type TableDesCtx = DataAPIDesCtx & { tableSchema: ListTableColumnDefinitions, parsers: Record<string, TableColumnTypeParser> };

export type TableColumnTypeParser = (val: any, ctx: TableDesCtx, definition: SomeDoc) => any;

export interface TableSerDesConfig<Schema extends SomeRow> {
  serialize?: OneOrMany<(this: SomeDoc, key: string, value: any, ctx: DataAPISerCtx<Schema>) => [any, boolean?] | boolean | undefined | void>,
  deserialize?: OneOrMany<(this: SomeDoc, key: string, value: any, ctx: TableDesCtx) => [any, boolean?] | boolean | undefined | void>,
  parsers?: Record<string, TableColumnTypeParser | { [$DeserializeForTables]: TableColumnTypeParser }>,
  mutateInPlace?: boolean,
}

export const mkTableSerDes = <Schema extends SomeRow>(cfg?: TableSerDesConfig<Schema>) => {
  const customParsers = { ...cfg?.parsers };

  for (const [key, parser] of Object.entries(customParsers)) {
    if (typeof parser === 'object' && $DeserializeForTables in parser) {
      customParsers[key] = parser[$DeserializeForTables];
    }
  }

  const parsers = { ...DefaultTableSerDesCfg.parsers, ...customParsers };

  return mkSerDes({
    serializer: [...toArray(cfg?.serialize ?? []), DefaultTableSerDesCfg.serialize],
    deserializer: [...toArray(cfg?.deserialize ?? []), DefaultTableSerDesCfg.deserialize],
    adaptSerCtx: (ctx) => ctx,
    adaptDesCtx: (_ctx) => {
      const ctx = _ctx as TableDesCtx;
      const tableSchema = ctx.rawDataApiResp.status?.primaryKeySchema ?? ctx.rawDataApiResp.status!.projectionSchema;

      if (Array.isArray(ctx.rootObj)) {
        ctx.rootObj = Object.fromEntries(Object.entries(tableSchema).map(([key], i) => {
          return [key, ctx.rootObj[i]];
        }));
      }

      ctx.tableSchema = tableSchema;
      ctx.parsers = parsers;

      return ctx;
    },
    mutateInPlace: cfg?.mutateInPlace,
  });
};

const DefaultTableSerDesCfg = {
  serialize(_, value) {
    if (typeof value === 'object' && value !== null) {
      if ($SerializeForTables in value) {
        return [value[$SerializeForTables](), true];
      }

      if (value instanceof Map) {
        return [Object.fromEntries(value)];
      }

      if (value instanceof Set) {
        return [[...value]];
      }
    }
  },
  deserialize(key, _, ctx) {
    if (this && this === ctx.rootObj) {
      deserializeObj(ctx, ctx.rootObj, key, ctx.tableSchema[key]);
    }
    return true;
  },
  parsers: {
    blob: (blob) => new (<any>CqlBlob)(blob), // it's ok for me to use the private constructor here, but no one else >:(
    date: (date) => new CqlDate(date),
    double: parseIEE754,
    duration: (duration) => new CqlDuration(duration),
    float: parseIEE754,
    inet: (inet) => new InetAddress(inet),
    time: (time) => new CqlTime(time),
    timestamp: (timestamp) => new CqlTimestamp(timestamp),
    uuid: (uuid) => new UUID(uuid, false),
    timeuuid: (uuid) => new UUID(uuid, false),
    vector: (vector) => new DataAPIVector(vector),
    varint: BigInt,
    map(map, ctx, def) {
      const entries = Array.isArray(map) ? map : Object.entries(map);

      for (let i = 0, n = entries.length; i < n; i++) {
        const [key, value] = entries[i];
        const keyParser = ctx.parsers[def.keyType];
        const valueParser = ctx.parsers[def.valueType];
        entries[i] = [keyParser ? keyParser(key, ctx, def) : key, valueParser ? valueParser(value, ctx, def) : value];
      }

      return new Map(entries);
    },
    list(values, ctx, def) {
      for (let i = 0, n = values.length; i < n; i++) {
        const elemParser = ctx.parsers[def.valueType];
        values[i] = elemParser ? elemParser(values[i], ctx, def) : values[i];
      }
      return values;
    },
    set(set, ctx, def) {
      return new Set(ctx.parsers.list(set, ctx, def));
    },
  },
} satisfies Omit<Required<TableSerDesConfig<SomeRow>>, 'mutateInPlace'>;

function deserializeObj(ctx: TableDesCtx, obj: SomeRow, key: string, column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) {
  const type = (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;

  const parser = ctx.parsers[type];

  if (parser) {
    obj[key] = parser(obj[key], ctx, column);
  }
}

function parseIEE754(val: number | 'NaN' | 'Infinity' | '-Infinity'): number {
  switch (val) {
    case 'NaN':
      return NaN;
    case 'Infinity':
      return Infinity;
    case '-Infinity':
      return -Infinity;
    default:
      return val;
  }
}
