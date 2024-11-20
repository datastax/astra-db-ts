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
  DataAPIBlob,
  DataAPIDate,
  DataAPIDuration,
  DataAPITime,
  DataAPITimestamp,
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
import BigNumber from 'bignumber.js';

export const $SerializeForTable = Symbol.for('astra-db-ts.serialize.table');

export interface TableSerCtx<Schema extends SomeDoc> extends DataAPISerCtx<Schema> {
  bigNumsPresent: boolean;
}

export interface TableDesCtx extends DataAPIDesCtx {
  tableSchema: ListTableColumnDefinitions,
  parsers: Record<string, TableColumnTypeParser>,
  parsingPrimaryKey: boolean,
  populateSparseData: boolean,
}

export type TableColumnTypeParser = (val: any, ctx: TableDesCtx, definition: SomeDoc) => any;

export interface TableSerDesConfig<Schema extends SomeRow> {
  serialize?: OneOrMany<(this: SomeDoc, key: string, value: any, ctx: TableSerCtx<Schema>) => [any, boolean?] | boolean | undefined | void>,
  deserialize?: OneOrMany<(this: SomeDoc, key: string, value: any, ctx: TableDesCtx) => [any, boolean?] | boolean | undefined | void>,
  parsers?: Record<string, TableColumnTypeParser>,
  mutateInPlace?: boolean,
  sparseData?: boolean,
}

/**
 * @internal
 */
export const mkTableSerDes = <Schema extends SomeRow>(cfg: TableSerDesConfig<Schema> | undefined) => mkSerDes({
  serializer: [...toArray(cfg?.serialize ?? []), DefaultTableSerDesCfg.serialize],
  deserializer: [...toArray(cfg?.deserialize ?? []), DefaultTableSerDesCfg.deserialize],
  adaptSerCtx: (_ctx) => {
    const ctx = _ctx as TableSerCtx<Schema>;
    ctx.bigNumsPresent = false;
    return ctx;
  },
  adaptDesCtx: (_ctx) => {
    const ctx = _ctx as TableDesCtx;
    const status = ctx.rawDataApiResp.status;

    if (status?.primaryKeySchema) {
      ctx.rootObj = Object.fromEntries(Object.entries(status.primaryKeySchema).map(([key], j) => {
        return [key, ctx.rootObj[j]];
      }));
      ctx.tableSchema = status.primaryKeySchema;
      ctx.parsingPrimaryKey = true;
    } else if (status?.projectionSchema) {
      ctx.tableSchema = status.projectionSchema;
      ctx.parsingPrimaryKey = false;
    } else {
      throw new Error('No schema found in response');
    }

    ctx.populateSparseData = cfg?.sparseData !== true;
    ctx.parsers = { ...DefaultTableSerDesCfg.parsers, ...cfg?.parsers };
    return ctx;
  },
  bigNumsPresent: (ctx) => ctx.bigNumsPresent,
  mutateInPlace: cfg?.mutateInPlace,
});

const DefaultTableSerDesCfg = {
  serialize(_, value, ctx) {
    if (typeof value === 'number') {
      if (!isFinite(value)) {
        return [value.toString(), true];
      }
      return true;
    } else if (typeof value === 'object' && value !== null) {
      if ($SerializeForTable in value) {
        return [value[$SerializeForTable](), true];
      }

      if (value instanceof Map) {
        return [Object.fromEntries(value)];
      }

      if (value instanceof Set) {
        return [[...value]];
      }

      if (value instanceof BigNumber) {
        ctx.bigNumsPresent = true;
        return true;
      }
    } else if (!ctx.bigNumsPresent && typeof value === 'bigint') {
      ctx.bigNumsPresent = true;
      return true;
    }
  },
  deserialize(key, _, ctx) {
    if (key === '') {
      if (Object.keys(ctx.rootObj).length === 0 && ctx.populateSparseData) {
        populateSparseData(ctx); // populate sparse data for empty objects
      }
      return false;
    }

    if (ctx.populateSparseData) { // do at this level to avoid looping on newly-populated fields if done at the top level
      populateSparseData(ctx);
      ctx.populateSparseData = false;
    }

    const schema = ctx.tableSchema[key];

    if (schema) {
      deserializeObj(ctx, ctx.rootObj, key, schema);
    }
    return true;
  },
  parsers: {
    bigint: (n) => parseInt(n),
    blob: (blob, ctx) => new DataAPIBlob((ctx.parsingPrimaryKey) ? { $binary: blob } : blob, false),
    date: (date) => new DataAPIDate(date),
    decimal: (decimal) => (decimal instanceof BigNumber) ? decimal : new BigNumber(decimal),
    double: parseFloat,
    duration: (duration) => new DataAPIDuration(duration),
    float: parseFloat,
    int: (n) => parseInt(n),
    inet: (inet) => new InetAddress(inet, null, false),
    smallint: (n) => parseInt(n),
    time: (time) => new DataAPITime(time),
    timestamp: (timestamp) => new DataAPITimestamp(timestamp),
    timeuuid: (uuid) => new UUID(uuid, false),
    tinyint: (n) => parseInt(n),
    uuid: (uuid) => new UUID(uuid, false),
    vector: (vector) => new DataAPIVector(vector, false),
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
} satisfies Pick<TableSerDesConfig<SomeRow>, 'parsers' | 'serialize' | 'deserialize'>;

function populateSparseData(ctx: TableDesCtx) {
  for (const key in ctx.tableSchema) {
    if (key in ctx.rootObj) {
      continue;
    }

    const type = resolveType(ctx.tableSchema[key]);

    if (type === 'map') {
      ctx.rootObj[key] = new Map();
    } else if (type === 'set') {
      ctx.rootObj[key] = new Set();
    } else if (type === 'list') {
      ctx.rootObj[key] = [];
    } else {
      ctx.rootObj[key] = null;
    }
  }
}

function deserializeObj(ctx: TableDesCtx, obj: SomeRow, key: string, column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) {
  const type = resolveType(column);
  const parser = ctx.parsers[type];

  if (parser && obj[key] !== null) {
    obj[key] = parser(obj[key], ctx, column);
  }
}

function resolveType(column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) {
  return (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;
}
