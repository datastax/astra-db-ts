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
import { EmptyObj, SerDesFn, SomeConstructor } from '@/src/lib';
import BigNumber from 'bignumber.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { DataAPIInet } from '@/src/documents/datatypes/inet';
import {
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
} from '@/src/db';

type TableSerFn = SerDesFn<TableSerCtx>;
type TableDesFn<Type extends string = string> = (key: Type, val: any, ctx: TableDesCtx, definition: TableDesFnDef<Type>) => ReturnType<SerDesFn<any>>;

type TableDesFnDef<Type> =
  | (ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) & { type: Type }
  | undefined;

/**
 * @public
 */
export interface TableCodecSerDesFns {
  serialize: TableSerFn,
  deserialize: TableDesFn,
}

/**
 * @public
 */
export type TableCodecClass = {
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

  public static forName(name: string, optsOrClass: TableNominalCodecOpts | TableCodecClass): RawTableCodec {
    return {
      tag: 'forName',
      name: name,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    };
  }

  public static forType<const Type extends string>(type: Type, optsOrClass: TableTypeCodecOpts<Type> | TableCodecClass): RawTableCodec {
    return {
      tag: 'forType',
      type: type,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    };
  }

  public static custom(opts: TableCustomCodecOpts): RawTableCodec {
    return { tag: 'custom', opts: opts };
  }
}

type TableSerGuard = (value: unknown, ctx: TableSerCtx) => boolean;
type TableDesGuard = (value: unknown, ctx: TableDesCtx) => boolean;

interface TableNominalCodecOpts {
  serialize?: TableSerFn,
  deserialize?: TableDesFn,
}

type TableTypeCodecOpts<Type extends string> =
  & (
    | { serialize: TableSerFn, serializeGuard: TableSerGuard, serializeClass?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.' }
    | { serialize: TableSerFn, serializeClass: SomeConstructor, serializeGuard?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.', }
    | { serialize?: never }
    )
  & { deserialize?: TableDesFn<Type> }

type TableCustomCodecOpts =
  & (
    | { serialize: TableSerFn, serializeGuard: TableSerGuard, serializeClass?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.' }
    | { serialize: TableSerFn, serializeClass: SomeConstructor, serializeGuard?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.', }
    | { serialize?: never }
    )
  & (
  | { deserialize: TableDesFn, deserializeGuard: TableDesGuard }
  | { deserialize?: never }
  )

export type RawTableCodec =
  | { tag: 'forName', name: string, opts: TableNominalCodecOpts }
  | { tag: 'forType', type: string, opts: TableTypeCodecOpts<any> }
  | { tag: 'custom', opts: TableCustomCodecOpts };

export interface TableSerializers {
  forName: Record<string, TableSerFn[]>,
  forClass: { class: SomeConstructor, fns: TableSerFn[] }[],
  forGuard: { guard: TableSerGuard, fn: TableSerFn }[],
}

export interface TableDeserializers {
  forName: Record<string, TableDesFn[]>,
  forType: Record<string, TableDesFn[]>,
  forGuard: { guard: TableDesGuard, fn: TableDesFn }[],
}

/**
 * @internal
 */
export const processCodecs = (raw: RawTableCodec[]): [TableSerializers, TableDeserializers] => {
  const serializers: TableSerializers = { forName: {}, forClass: [], forGuard: [] };
  const deserializers: TableDeserializers = { forName: {}, forType: {}, forGuard: [] };

  for (const codec of raw) {
    switch (codec.tag) {
      case 'forName':
        codec.opts.serialize && (serializers.forName[codec.name] ??= []).push(codec.opts.serialize);
        codec.opts.deserialize && (deserializers.forName[codec.name] ??= []).push(codec.opts.deserialize);
        break;
      case 'forType':
        ('serializeGuard' in codec.opts && !codec.opts['serializeClass']) && serializers.forGuard.push({ guard: codec.opts.serializeGuard, fn: codec.opts.serialize });
        ('serializeClass' in codec.opts && !codec.opts['serializeGuard']) && findOrInsertClass(serializers.forClass, codec.opts.serializeClass, codec.opts.serialize);
        codec.opts.deserialize && (deserializers.forType[codec.type] ??= []).push(codec.opts.deserialize);
        break;
      case 'custom':
        ('serializeGuard' in codec.opts && !codec.opts['serializeClass']) && serializers.forGuard.push({ guard: codec.opts.serializeGuard, fn: codec.opts.serialize });
        ('serializeClass' in codec.opts && !codec.opts['serializeGuard']) && findOrInsertClass(serializers.forClass, codec.opts.serializeClass, codec.opts.serialize);
        ('deserializeGuard' in codec.opts) && deserializers.forGuard.push({ guard: codec.opts.deserializeGuard, fn: codec.opts.deserialize });
        break;
    }
  }

  return [serializers, deserializers];
};

const findOrInsertClass = <Fn>(arr: { class: SomeConstructor, fns: Fn[] }[], newClass: SomeConstructor, fn: Fn) => {
  for (const { class: clazz, fns } of arr) {
    if (clazz === newClass) {
      fns.push(fn);
      return;
    }
  }
  arr.push({ class: newClass, fns: [fn] });
};

// forName('name', delegate | { serialize?, deserialize? })

// forType('name', delegate | { ((serializeGuard | serializeClass) & serialize)?, deserialize? })

// custom({ ((serializeGuard | serializeClass) & serialize)?, (deserializeGuard & deserialize)? })
