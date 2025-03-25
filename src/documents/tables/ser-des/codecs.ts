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
import type {
  CustomCodecOpts,
  NominalCodecOpts,
  RawCodec,
  SerDesFn,
  SomeConstructor,
  TypeCodecOpts,
} from '@/src/lib/index.js';
import { escapeFieldNames } from '@/src/lib/index.js';
import { BigNumber } from 'bignumber.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { DataAPIInet } from '@/src/documents/datatypes/inet.js';
import { betterTypeOf } from '@/src/documents/utils.js';
import { assertHasDeserializeFor, assertHasSerializeFor } from '@/src/lib/api/ser-des/utils.js';
import type { PathSegment } from '@/src/lib/types.js';

/**
 * @public
 */
export type TableCodecClass =
  & (abstract new (...args: any[]) => { [$SerializeForTable]: (ctx: TableSerCtx) => ReturnType<SerDesFn<any>> })
  & { [$DeserializeForTable]: SerDesFn<TableDesCtx> }

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
      deserialize: (value, ctx) => ctx.done(BigNumber(value)),
    }),
    double: TableCodecs.forType('double', {
      deserialize: (value, ctx) => ctx.done(parseFloat(value)),
    }),
    duration: TableCodecs.forType('duration', DataAPIDuration),
    float: TableCodecs.forType('float', {
      deserialize: (value, ctx) => ctx.done(parseFloat(value)),
    }),
    int: TableCodecs.forType('int', {
      deserialize: (value, ctx) => ctx.done(value),
    }),
    inet: TableCodecs.forType('inet', DataAPIInet),
    smallint: TableCodecs.forType('smallint', {
      deserialize: (value, ctx) => ctx.done(value),
    }),
    time: TableCodecs.forType('time', DataAPITime),
    timestamp: TableCodecs.forType('timestamp', {
      serializeClass: Date,
      serialize(date, ctx) {
        if (isNaN(date.valueOf())) {
          throw new Error(`Can not serialize an invalid date (at '${escapeFieldNames(ctx.path)}')`);
        }
        return ctx.done(date.toISOString());
      },
      deserialize(value, ctx) {
        return ctx.done(new Date(value));
      },
    }),
    timeuuid: TableCodecs.forType('timeuuid', UUID),
    tinyint: TableCodecs.forType('tinyint', {
      deserialize: (value, ctx) => ctx.done(value),
    }),
    uuid: TableCodecs.forType('uuid', UUID),
    vector: TableCodecs.forType('vector', DataAPIVector),
    varint: TableCodecs.forType('varint', {
      deserialize: (value, ctx) => {
        return ctx.done(BigInt(value));
      },
    }),
    map: TableCodecs.forType('map', {
      serializeClass: Map,
      serialize: (value, ctx) => {
        return ctx.recurse(Object.fromEntries(value));
      },
      deserialize(_, ctx) {
        /* c8 ignore next: not in data api yet */
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
    validateIfCodecClass(optsOrClass);

    return [{
      tag: 'forName',
      name: name,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    }];
  }

  /**
   * @deprecated
   */
  public static forPath(path: readonly PathSegment[], optsOrClass: TableNominalCodecOpts | TableCodecClass): RawTableCodecs {
    validateIfCodecClass(optsOrClass);

    return [{
      tag: 'forPath',
      path: path,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    }];
  }

  public static forType<const Type extends string>(type: Type, optsOrClass: TableTypeCodecOpts | TableCodecClass): RawTableCodecs {
    validateIfCodecClass(optsOrClass);

    return [{
      tag: 'forType',
      type: type,
      opts: ($DeserializeForTable in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForTable] } : optsOrClass,
    }];
  }

  public static custom(opts: TableCustomCodecOpts): RawTableCodecs {
    return [{ tag: 'custom', opts: opts }];
  }

  public static asCodecClass<Class extends SomeConstructor>(clazz: Class, fns?: AsTableCodecClassFns<Class>): TableCodecClass {
    if (fns) {
      if (!('prototype' in clazz)) {
        throw new TypeError(`Cannot attach ser/des functions to non-class ${clazz}`);
      }
      (clazz as any)[$DeserializeForTable] = fns.deserializeForTable;
      (clazz.prototype)[$SerializeForTable] = fns.serializeForTable;
    }
    assertIsCodecClass(clazz);
    return clazz;
  }
}

export interface AsTableCodecClassFns<Class extends SomeConstructor> {
  serializeForTable: (this: InstanceType<Class>, ctx: TableSerCtx) => ReturnType<SerDesFn<any>>;
  deserializeForTable: SerDesFn<TableDesCtx>;
}

function assertIsCodecClass(clazz: unknown): asserts clazz is TableCodecClass {
  if (typeof clazz !== 'function') {
    throw new TypeError(`Invalid codec class: expected a constructor; got ${betterTypeOf(clazz)}`);
  }
  assertHasSerializeFor(clazz, $SerializeForTable, '$SerializeForTable');
  assertHasDeserializeFor(clazz, $DeserializeForTable, '$DeserializeForTable');
}

function validateIfCodecClass<T>(val: TableCodecClass | T) {
  if (typeof val === 'function') {
    // We can't check for $SerializeForTable here because it may not be on the prototype, depending on how it's
    // implemented in the class. This at least helps catch cases when a completely wrong class is passed.
    assertHasDeserializeFor(val, $DeserializeForTable, '$DeserializeForTable');
  }
}
