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
import { DataAPIDate } from '@/src/documents/datatypes/date';
import { DataAPIDuration } from '@/src/documents/datatypes/duration';
import { DataAPITime } from '@/src/documents/datatypes/time';
import { UUID } from '@/src/documents/datatypes/uuid';
import { DataAPIVector } from '@/src/documents/datatypes/vector';
import { TableDesCtx, TableSerCtx } from '@/src/documents';
import {
  CustomCodecOpts,
  Deserializers,
  EmptyObj,
  NominalCodecOpts,
  RawCodec,
  SerDesFn,
  Serializers,
  TypeCodecOpts,
} from '@/src/lib';
import BigNumber from 'bignumber.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { DataAPIInet } from '@/src/documents/datatypes/inet';
import { ListTableKnownColumnDefinition, ListTableUnsupportedColumnDefinition } from '@/src/db';

type TableSerFn = SerDesFn<TableSerCtx>;
type TableDesFn<Type extends string = string> = (key: Type, val: any, ctx: TableDesCtx, definition: TableDesFnDef<Type>) => ReturnType<SerDesFn<any>>;

type TableDesFnDef<Type> =
  | (ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) & { type: Type }
  | undefined;

/**
 * @public
 */
export type TableCodecClass = {
  new (...args: any[]): { [$SerializeForTable]: (ctx: TableSerCtx) => ReturnType<SerDesFn<any>> };
  [$DeserializeForTable]: TableDesFn;
}

/**
 * @public
 */
export type TableCodec<_Class extends TableCodecClass> = EmptyObj;

/**
 * @public
 */
export class TableCodecs {
  public static Defaults = {
    bigint: TableCodecs.forType('bigint', {
      deserialize: (_, value, ctx) => ctx.done(BigInt(value)),
    }),
    blob: TableCodecs.forType('blob', DataAPIBlob),
    counter: TableCodecs.forType('counter', {
      deserialize: (_, value, ctx) => ctx.done(BigInt(value)),
    }),
    date: TableCodecs.forType('date', DataAPIDate),
    decimal: TableCodecs.forType('decimal', {
      deserialize: (_, value, ctx) => ctx.done((value instanceof BigNumber) ? value : new BigNumber(value)),
    }),
    double: TableCodecs.forType('double', {
      deserialize: (_, value, ctx) => ctx.done(parseFloat(value)),
    }),
    duration: TableCodecs.forType('duration', DataAPIDuration),
    float: TableCodecs.forType('float', {
      deserialize: (_, value, ctx) => ctx.done(parseFloat(value)),
    }),
    int: TableCodecs.forType('int', {
      deserialize: (_, value, ctx) => ctx.done(parseInt(value, 10)),
    }),
    inet: TableCodecs.forType('inet', DataAPIInet),
    smallint: TableCodecs.forType('smallint', {
      deserialize: (_, value, ctx) => ctx.done(parseInt(value, 10)),
    }),
    time: TableCodecs.forType('time', DataAPITime),
    timestamp: TableCodecs.forType('timestamp', {
      serializeClass: Date,
      serialize(_, value, ctx) {
        return ctx.done(value.toISOString());
      },
      deserialize(_, value, ctx) {
        return ctx.done(new Date(value));
      },
    }),
    timeuuid: TableCodecs.forType('timeuuid', UUID),
    tinyint: TableCodecs.forType('tinyint', {
      deserialize: (_, value, ctx) => ctx.done(parseInt(value, 10)),
    }),
    uuid: TableCodecs.forType('uuid', UUID),
    vector: TableCodecs.forType('vector', DataAPIVector),
    varint: TableCodecs.forType('varint', {
      deserialize: (_, value, ctx) => ctx.done(BigInt(value)),
    }),
    map: TableCodecs.forType('map', {
      serializeClass: Map,
      serialize: (_, value, ctx) => {
        return ctx.next(Object.fromEntries(value));
      },
      deserialize(_, map, ctx, def) {
        const entries = Array.isArray(map) ? map : Object.entries(map);

        for (let i = 0, n = entries.length; i < n; i++) {
          const [key, value] = entries[i];

          const keyParser = ctx.deserializers.forType[def!.keyType]?.[0];
          const valueParser = ctx.deserializers.forType[def!.valueType]?.[0];

          entries[i] = [
            keyParser ? keyParser(i.toString(), key, ctx, def)[1] : key,
            valueParser ? valueParser(i.toString(), value, ctx, def)[1] : value,
          ];
        }

        return ctx.done(new Map(entries));
      },
    }),
    list: TableCodecs.forType('list', {
      deserialize(_, list, ctx, def) {
        for (let i = 0, n = list.length; i < n; i++) {
          const elemParser = ctx.deserializers.forType[def!.valueType]?.[0];
          list[i] = elemParser ? elemParser(i.toString(), list[i], ctx, def)[1] : list[i];
        }
        return ctx.done(list);
      },
    }),
    set: TableCodecs.forType('set', {
      serializeClass: Set,
      serialize: (_, value, ctx) => {
        return ctx.next([...value]);
      },
      deserialize(_, list, ctx, def) {
        for (let i = 0, n = list.length; i < n; i++) {
          const elemParser = ctx.deserializers.forType[def!.valueType]?.[0];
          list[i] = elemParser ? elemParser(i.toString(), list[i], ctx, def)[1] : list[i];
        }
        return ctx.done(new Set(list));
      },
    }),
  };

  public static forName(name: string, optsOrClass: TableNominalCodecOpts | TableCodecClass): RawCodec<'table'> {
    return {
      tag: 'forName',
      name: name,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    };
  }

  public static forType<const Type extends string>(type: Type, optsOrClass: TableTypeCodecOpts<Type> | TableCodecClass): RawCodec<'table'> {
    return {
      tag: 'forType',
      type: type,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    };
  }

  public static custom(opts: TableCustomCodecOpts): RawCodec<'table'> {
    return { tag: 'custom', opts: opts };
  }
}

type TableSerGuard = (value: unknown, ctx: TableSerCtx) => boolean;
type TableDesGuard = (value: unknown, ctx: TableDesCtx) => boolean;

/**
 * @public
 */
export type TableNominalCodecOpts = NominalCodecOpts<TableSerFn, TableDesFn>;

/**
 * @public
 */
export type TableTypeCodecOpts<Type extends string> = TypeCodecOpts<TableSerFn, TableSerGuard, TableDesFn<Type>>

/**
 * @public
 */
export type TableCustomCodecOpts = CustomCodecOpts<TableSerFn, TableSerGuard, TableDesFn, TableDesGuard>;

/**
 * @public
 */
export type TableSerializers = Omit<Serializers<TableSerFn, TableSerGuard>, 'forPath'>;

/**
 * @public
 */
export type TableDeserializers = Omit<Deserializers<TableDesFn, TableDesGuard>, 'forPath'>;
