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

// Important to import from specific paths here to avoid circular dependencies
import { DataAPIBlob } from '@/src/documents/datatypes/blob';
import { DataAPIDate, DataAPIDuration, DataAPITime, DataAPITimestamp } from '@/src/documents/datatypes/dates';
import { InetAddress } from '@/src/documents/datatypes/inet-address';
import { UUID } from '@/src/documents/datatypes/uuid';
import { DataAPIVector } from '@/src/documents/datatypes/vector';
import { SomeDoc, TableDesCtx, TableSerCtx } from '@/src/documents';
import { CodecHolder } from '@/src/lib/api/ser-des/codecs';
import { EmptyObj, SerDesFn } from '@/src/lib';
import BigNumber from 'bignumber.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';

/**
 * @public
 */
export interface TableCodecSerDesFns {
  serialize: SerDesFn<TableSerCtx>,
  deserialize: (val: any, ctx: TableDesCtx, definition: SomeDoc) => ReturnType<SerDesFn<any>>,
}

/**
 * @public
 */
export interface TableCodecClass {
  new (...args: any[]): { [$SerializeForTable]: (ctx: TableSerCtx) => ReturnType<SerDesFn<any>> };
  [$DeserializeForTable]: TableCodecSerDesFns['deserialize'];
}

/**
 * @public
 */
export type TableCodec<_Class extends TableCodecClass> = EmptyObj;

/**
 * @public
 */
export class TableCodecs implements CodecHolder<TableCodecSerDesFns> {
  /**
   * @internal
   */
  public readonly get: CodecHolder<TableCodecSerDesFns>['get'];

  /**
   * @internal
   */
  public constructor(state: typeof this.get) {
    this.get = state;
  }

  public static Defaults = {
    bigint: TableCodecs.forType('bigint', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done(parseInt(value)),
    }),
    blob: TableCodecs.forType('blob', DataAPIBlob),
    date: TableCodecs.forType('date', DataAPIDate),
    decimal: TableCodecs.forType('decimal', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done((value instanceof BigNumber) ? value : new BigNumber(value)),
    }),
    double: TableCodecs.forType('double', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done(parseFloat(value)),
    }),
    duration: TableCodecs.forType('duration', DataAPIDuration),
    float: TableCodecs.forType('float', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done(parseFloat(value)),
    }),
    int: TableCodecs.forType('int', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done(parseInt(value)),
    }),
    inet: TableCodecs.forType('inet', InetAddress),
    smallint: TableCodecs.forType('smallint', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done(parseInt(value)),
    }),
    time: TableCodecs.forType('time', DataAPITime),
    timestamp: TableCodecs.forType('timestamp', DataAPITimestamp),
    timeuuid: TableCodecs.forType('timeuuid', UUID),
    tinyint: TableCodecs.forType('tinyint', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done(parseInt(value)),
    }),
    uuid: TableCodecs.forType('uuid', UUID),
    vector: TableCodecs.forType('vector', DataAPIVector),
    varint: TableCodecs.forType('varint', {
      deserializeOnly: true,
      deserialize: (value, ctx) => ctx.done(BigInt(value)),
    }),
    map: TableCodecs.forType('map', {
      serializeClass: Map,
      serialize: (_, value, ctx) => {
        return ctx.recurse(Object.fromEntries(value));
      },
      deserialize(map, ctx, def) {
        const entries = Array.isArray(map) ? map : Object.entries(map);

        for (let i = 0, n = entries.length; i < n; i++) {
          const [key, value] = entries[i];

          const keyParser = ctx.codecs.type[def.keyType];
          const valueParser = ctx.codecs.type[def.valueType];

          entries[i] = [
            keyParser ? keyParser.deserialize(key, ctx, def)[1] : key,
            valueParser ? valueParser.deserialize(value, ctx, def)[1] : value,
          ];
        }

        return ctx.done(new Map(entries));
      },
    }),
    list: TableCodecs.forType('list', {
      deserializeOnly: true,
      deserialize(list, ctx, def) {
        for (let i = 0, n = list.length; i < n; i++) {
          const elemParser = ctx.codecs.type[def.valueType];
          list[i] = elemParser ? elemParser.deserialize(list[i], ctx, def)[1] : list[i];
        }
        return ctx.done(list);
      },
    }),
    set: TableCodecs.forType('set', {
      serializeClass: Set,
      serialize: (_, value, ctx) => {
        return ctx.recurse([...value]);
      },
      deserialize(list, ctx, def) {
        for (let i = 0, n = list.length; i < n; i++) {
          const elemParser = ctx.codecs.type[def.valueType];
          list[i] = elemParser ? elemParser.deserialize(list[i], ctx, def)[1] : list[i];
        }
        return ctx.done(new Set(list));
      },
    }),
  };

  public static Overrides = {

  };

  public static forPath(path: string[], clazz: TableCodecClass): TableCodecs

  public static forPath(path: string[], opts: TableCodecSerDesFns): TableCodecs

  public static forPath(path: string[], clazzOrOpts: TableCodecClass | TableCodecSerDesFns): TableCodecs {
    if ($DeserializeForTable in clazzOrOpts) {
      return new TableCodecs({ codecType: 'path', path, deserialize: clazzOrOpts[$DeserializeForTable] });
    }
    return new TableCodecs({ codecType: 'path', path, ...clazzOrOpts });
  }

  public static forName(name: string, clazz: TableCodecClass): TableCodecs

  public static forName(name: string, opts: TableCodecSerDesFns): TableCodecs

  public static forName(name: string, clazzOrOpts: TableCodecClass | TableCodecSerDesFns): TableCodecs {
    if ($DeserializeForTable in clazzOrOpts) {
      return new TableCodecs({ codecType: 'name', name, deserialize: clazzOrOpts[$DeserializeForTable] });
    }
    return new TableCodecs({ codecType: 'name', name, ...clazzOrOpts });
  }

  public static forType(type: string, clazz: TableCodecClass): TableCodecs;

  public static forType(type: string, opts: TableCodecSerDesFns & { serializeGuard: (value: unknown, ctx: TableSerCtx) => boolean }): TableCodecs;

  public static forType(type: string, opts: TableCodecSerDesFns & { serializeClass: new (...args: any[]) => any }): TableCodecs;

  public static forType(type: string, opts: Pick<TableCodecSerDesFns, 'deserialize'> & { deserializeOnly: true }): TableCodecs;

  public static forType(type: string, clazzOrOpts: any): TableCodecs {
    if ($DeserializeForTable in clazzOrOpts) {
      return new TableCodecs({ codecType: 'type', type, deserialize: clazzOrOpts[$DeserializeForTable] });
    }
    return new TableCodecs({ codecType: 'type', type, ...clazzOrOpts });
  }
}
