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

import { SomeDoc, SomeRow } from '@/src/documents';
import { SerDes, SerDesConfig } from '@/src/lib/api/ser-des/ser-des';
import {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
} from '@/src/db';
import { $SerializeForTable, TableCodecs, TableCodecSerDesFns } from '@/src/documents/tables/ser-des/codecs';
import { BaseDesCtx, BaseSerCtx } from '@/src/lib/api/ser-des/ctx';

export interface TableSerCtx extends BaseSerCtx<TableCodecSerDesFns> {
  bigNumsPresent: boolean;
}

export interface TableDesCtx extends BaseDesCtx<TableCodecSerDesFns> {
  tableSchema: ListTableColumnDefinitions,
  parsingPrimaryKey: boolean,
  populateSparseData: boolean,
  done: never,
  continue: never,
}

export type TableColumnTypeParser = (val: any, ctx: TableDesCtx, definition: SomeDoc) => any;

export interface TableSerDesConfig extends SerDesConfig<TableCodecs, TableCodecSerDesFns, TableSerCtx, TableDesCtx> {
  sparseData?: boolean,
}

/**
 * @internal
 */
export class TableSerDes extends SerDes<TableCodecSerDesFns, TableSerCtx, TableDesCtx> {
  declare protected readonly _cfg: TableSerDesConfig;

  public constructor(cfg?: TableSerDesConfig) {
    super(TableSerDes.mergeConfig(DefaultTableSerDesCfg, cfg));
  }

  public override adaptSerCtx(ctx: TableSerCtx): TableSerCtx {
    ctx.bigNumsPresent = false;
    return ctx;
  }

  public override adaptDesCtx(ctx: TableDesCtx): TableDesCtx {
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

    (<any>ctx).done = () => { throw new Error('ctx.done() should not be used for table deserialization; just return void or false'); };
    (<any>ctx).continue = () => { throw new Error('ctx.continue() should not be used for table deserialization; instead, recursively call the next typeCodecs'); };

    ctx.populateSparseData = this._cfg?.sparseData !== true;
    return ctx;
  }

  public override bigNumsPresent(ctx: TableSerCtx): boolean {
    return ctx.bigNumsPresent;
  }

  public static mergeConfig(...cfg: (TableSerDesConfig | undefined)[]): TableSerDesConfig {
    return {
      sparseData: cfg.reduce<boolean | undefined>((acc, c) => c?.sparseData ?? acc, undefined),
      ...super._mergeConfig(...cfg),
    };
  }
}

const DefaultTableSerDesCfg = {
  serialize(key, value, ctx) {
    if (ctx.depth === 1 && key in ctx.nameCodecs) {
      return ctx.nameCodecs[key].serialize?.(key, value, ctx) ?? true;
    }

    if (typeof value === 'object' && value !== null) {
      if (value[$SerializeForTable]) {
        return value[$SerializeForTable](ctx);
      }

      for (const codec of ctx.classGuardCodecs) {
        if (value instanceof codec.class) {
          return codec.serialize(key, value, ctx);
        }
      }
    }

    for (const codec of ctx.customGuardCodecs) {
      if (codec.guard(value, ctx)) {
        return codec.serialize(key, value, ctx);
      }
    }
  },
  deserialize(key, value, ctx) {
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

    if (ctx.tableSchema[key]) {
      deserializeObj(ctx, ctx.rootObj, key, ctx.tableSchema[key]);
    }

    return true;
  },
  codecs: Object.values(TableCodecs.Defaults),
} satisfies Pick<TableSerDesConfig, 'codecs' | 'serialize' | 'deserialize'>;

// const _DefaultTableSerDesCfg = {
//   serialize(_, value, ctx) {
//     if (typeof value === 'number') {
//       if (!isFinite(value)) {
//         return [value.toString(), true];
//       }
//       return true;
//     } else if (typeof value === 'object' && value !== null) {
//       if ($SerializeForTable in value) {
//         return [value[$SerializeForTable](), true];
//       }
//
//       if (value instanceof Map) {
//         return [Object.fromEntries(value), false];
//       }
//
//       if (value instanceof Set) {
//         return [[...value], false];
//       }
//
//       if (value instanceof BigNumber) {
//         ctx.bigNumsPresent = true;
//         return true;
//       }
//     } else if (!ctx.bigNumsPresent && typeof value === 'bigint') {
//       ctx.bigNumsPresent = true;
//       return true;
//     }
//   },
//   deserialize(key, _, ctx) {
//     if (key === '') {
//       if (Object.keys(ctx.rootObj).length === 0 && ctx.populateSparseData) {
//         populateSparseData(ctx); // populate sparse data for empty objects
//       }
//       return false;
//     }
//
//     if (ctx.populateSparseData) { // do at this level to avoid looping on newly-populated fields if done at the top level
//       populateSparseData(ctx);
//       ctx.populateSparseData = false;
//     }
//
//     const schema = ctx.tableSchema[key];
//
//     if (schema) {
//       deserializeObj(ctx, ctx.rootObj, key, schema);
//     }
//     return true;
//   },
//   parsers: {
//     list(values, ctx, def) {
//       for (let i = 0, n = values.length; i < n; i++) {
//         const elemParser = ctx.parsers[def.valueType];
//         values[i] = elemParser ? elemParser(values[i], ctx, def) : values[i];
//       }
//       return values;
//     },
//     set(set, ctx, def) {
//       return new Set(ctx.parsers.list(set, ctx, def));
//     },
//   },
// } satisfies Pick<TableSerDesConfig, 'codecs' | 'serialize' | 'deserialize'>;

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

  if (key in ctx.nameCodecs) {
    return obj[key] = ctx.nameCodecs[key].deserialize(obj[key], ctx, column);
  }

  if (type in ctx.typeCodecs) {
    return obj[key] = ctx.typeCodecs[type].deserialize(obj[key], ctx, column);
  }
}

function resolveType(column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) {
  return (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;
}
