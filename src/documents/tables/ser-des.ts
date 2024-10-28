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

import { CqlDate, CqlDuration, CqlTime, CqlTimestamp, InetAddress, SomeDoc, SomeRow, UUID } from '@/src/documents';
import { $SerializeRelaxed, DataAPIDesCtx, DataAPIDesFn, DataAPISerCtx, DataAPISerFn } from '@/src/lib/api/ser-des';
import {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
  TableScalarType,
} from '@/src/db';

export interface TableSerDes<Schema extends SomeRow> {
  serialize: DataAPISerFn<DataAPISerCtx<Schema>>,
  deserialize: DataAPIDesFn<DataAPIDesCtx & { tableSchema: ListTableColumnDefinitions }>,
}

export const DefaultTableSerDes: TableSerDes<SomeDoc> = {
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
      deserializeObj(ctx.rootObj, key, ctx.tableSchema[key]);
    }
    return true;
  },
};

const deserializeObj = (rootObj: SomeDoc, key: string, column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) => {
  const type = (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;

  const parser = Parsers[type];

  if (parser) {
    rootObj[key] = parser(rootObj[key], (<any>column).valueType, (<any>column).keyType);
  }
};

const Parsers: Record<string, (val: any, v?: TableScalarType, k?: TableScalarType) => any> = {
  date: (date) => new CqlDate(date),
  duration: (duration) => new CqlDuration(duration),
  inet: (inet) => new InetAddress(inet),
  time: (time) => new CqlTime(time),
  timestamp: (timestamp) => new CqlTimestamp(timestamp),
  uuid: (uuid) => new UUID(uuid, false),
  timeuuid: (uuid) => new UUID(uuid, false),
  varint: BigInt,
  map(map, v, k) {
    const entries = Array.isArray(map) ? map : Object.entries(map);

    for (let i = entries.length; i--;) {
      const [key, value] = entries[i];
      entries[i] = [Parsers[k!] ? Parsers[k!](key) : key, Parsers[v!] ? Parsers[v!](value) : value];
    }

    return new Map(entries);
  },
  list(values, v) {
    for (let i = values.length; i--;) {
      values[i] = Parsers[v!] ? Parsers[v!](values[i]) : values[i];
    }
    return values;
  },
  set(set, v) {
    return new Set(Parsers.list(set, v));
  },
};
