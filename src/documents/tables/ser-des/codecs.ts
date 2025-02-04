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
import { DataAPIBlob } from '@/src/documents/datatypes/blob.js';
import { DataAPIDate } from '@/src/documents/datatypes/date.js';
import { DataAPIDuration } from '@/src/documents/datatypes/duration.js';
import { DataAPITime } from '@/src/documents/datatypes/time.js';
import { UUID } from '@/src/documents/datatypes/uuid.js';
import { DataAPIVector } from '@/src/documents/datatypes/vector.js';
import type { TableDesCtx, TableSerCtx } from '@/src/documents/index.js';
import type { CustomCodecOpts, NominalCodecOpts, RawCodec, SerDesFn, TypeCodecOpts } from '@/src/lib/index.js';
import { BigNumber } from 'bignumber.js';
import type { $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { $DeserializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { DataAPIInet } from '@/src/documents/datatypes/inet.js';

/**
 * @public
 */
export interface TableCodecClass {
  new (...args: any[]): { [$SerializeForTable]: (ctx: TableSerCtx) => ReturnType<SerDesFn<any>> };
  [$DeserializeForTable]: SerDesFn<TableDesCtx>;
}

/**
 * @public
 */
export type TableCodec<Class extends TableCodecClass> = InstanceType<Class>;

/**
 * @public
 */
export type RawTableCodecs = readonly RawCodec<TableSerCtx, TableDesCtx>[] & { phantom?: 'This codec is only valid for tables' };

/**
 * @public
 */
export type TableNominalCodecOpts = NominalCodecOpts<TableSerCtx, TableDesCtx>;

/**
 * @public
 */
export type TableTypeCodecOpts = TypeCodecOpts<TableSerCtx, TableDesCtx>;

/**
 * @public
 */
export type TableCustomCodecOpts = CustomCodecOpts<TableSerCtx, TableDesCtx>;

/**
 * @public
 */
export class TableCodecs {
  public static Defaults = {
    bigint: TableCodecs.forType('bigint', {
      deserialize: (value, ctx) => ctx.done(BigInt(value)),
    }),
    blob: TableCodecs.forType('blob', DataAPIBlob),
    counter: TableCodecs.forType('counter', {
      deserialize: (value, ctx) => ctx.done(BigInt(value)),
    }),
    date: TableCodecs.forType('date', DataAPIDate),
    decimal: TableCodecs.forType('decimal', {
      deserialize: (value, ctx) => ctx.done((value instanceof BigNumber) ? value : new BigNumber(value)),
    }),
    double: TableCodecs.forType('double', {
      deserialize: (value, ctx) => ctx.done(parseFloat(value)),
    }),
    duration: TableCodecs.forType('duration', DataAPIDuration),
    float: TableCodecs.forType('float', {
      deserialize: (value, ctx) => ctx.done(parseFloat(value)),
    }),
    int: TableCodecs.forType('int', {
      deserialize: (value, ctx) => ctx.done(parseInt(value, 10)),
    }),
    inet: TableCodecs.forType('inet', DataAPIInet),
    smallint: TableCodecs.forType('smallint', {
      deserialize: (value, ctx) => ctx.done(parseInt(value, 10)),
    }),
    time: TableCodecs.forType('time', DataAPITime),
    timestamp: TableCodecs.forType('timestamp', {
      serializeClass: Date,
      serialize(value, ctx) {
        return ctx.done(value.toISOString());
      },
      deserialize(value, ctx) {
        return ctx.done(new Date(value));
      },
    }),
    timeuuid: TableCodecs.forType('timeuuid', UUID),
    tinyint: TableCodecs.forType('tinyint', {
      deserialize: (value, ctx) => ctx.done(parseInt(value, 10)),
    }),
    uuid: TableCodecs.forType('uuid', UUID),
    vector: TableCodecs.forType('vector', DataAPIVector),
    varint: TableCodecs.forType('varint', {
      deserialize: (value, ctx) => ctx.done(BigInt(value)),
    }),
    map: TableCodecs.forType('map', {
      serializeClass: Map,
      serialize: (value, ctx) => {
        return ctx.recurse(Object.fromEntries(value));
      },
      deserialize(_, ctx) {
        ctx.mapAfter((es) => new Map(Array.isArray(es) ? es : Object.entries(es)));
        return ctx.recurse();
      },
    }),
    list: TableCodecs.forType('list', {
      deserialize(_, ctx) {
        return ctx.recurse();
      },
    }),
    set: TableCodecs.forType('set', {
      serializeClass: Set,
      serialize: (value, ctx) => {
        return ctx.recurse([...value]);
      },
      deserialize(_, ctx) {
        ctx.mapAfter((es) => new Set(es));
        return ctx.recurse();
      },
    }),
  };

  public static forName(name: string, optsOrClass: TableNominalCodecOpts | TableCodecClass): RawTableCodecs {
    return [{
      tag: 'forName',
      name: name,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    }];
  }

  public static forPath(path: (string | number)[], optsOrClass: TableNominalCodecOpts | TableCodecClass): RawTableCodecs {
    return [{
      tag: 'forPath',
      path: path,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    }];
  }

  public static forType<const Type extends string>(type: Type, optsOrClass: TableTypeCodecOpts | TableCodecClass): RawTableCodecs {
    return [{
      tag: 'forType',
      type: type,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    }];
  }

  public static custom(opts: TableCustomCodecOpts): RawTableCodecs {
    return [{ tag: 'custom', opts: opts }];
  }
}
