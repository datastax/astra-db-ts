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
import { DataAPIDesCtx, DataAPIDesFn, DataAPISerCtx, DataAPISerFn } from '@/src/lib/api/ser-des';
import {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
} from '@/src/db';

export interface TableSerDes<Schema extends SomeRow> {
  serialize: DataAPISerFn<DataAPISerCtx<Schema>>,
  deserialize: DataAPIDesFn<DataAPIDesCtx & { tableSchema: ListTableColumnDefinitions }>,
}

export const DefaultTableSerDes: TableSerDes<SomeDoc> = {
  serialize(_, value) {
    if (typeof value === 'object') {
      if (value instanceof CqlDate) {
        return [{ $date: value.toString() }, false];
      }

      if (value instanceof CqlDuration) {
        return [{ $duration: value.toString() }, false];
      }

      if (value instanceof InetAddress) {
        return [{ $inet: value.toString() }, false];
      }

      if (value instanceof CqlTime) {
        return [{ $time: value.toString() }, false];
      }

      if (value instanceof CqlTimestamp) {
        return [{ $timestamp: value.toString() }, false];
      }

      if (value instanceof UUID) {
        return [{ $uuid: value.toString() }, false];
      }
    }
    return undefined;
  },
  deserialize(key, _, ctx) {
    if (this === ctx.rootObj) {
      deserializeRootObj(ctx.rootObj, key, ctx.tableSchema[key]);
    }
    return false;
  },
};

const deserializeRootObj = (rootObj: SomeDoc, key: string, column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) => {
  const type = (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;

  const parser = Parsers[type];

  if (parser) {
    rootObj[key] = parser(rootObj[key]);
  }
};

const Parsers: Record<string, (val: any) => any> = {
  date: (date) => new CqlDate(date),
  duration: (duration) => new CqlDuration(duration),
  inet: (inet) => new InetAddress(inet),
  time: (time) => new CqlTime(time),
  timestamp: (timestamp) => new CqlTimestamp(timestamp),
  uuid: (uuid) => new UUID(uuid),
  timeuuid: (uuid) => new UUID(uuid),
  varint: BigInt,
};
