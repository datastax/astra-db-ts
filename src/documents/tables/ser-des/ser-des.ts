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

import type { BaseSerDesConfig, SerDesFn } from '@/src/lib/api/ser-des/ser-des.js';
import { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import type {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
  ListTypeDefinition,
} from '@/src/db/index.js';
import type { RawTableCodecs } from '@/src/documents/tables/ser-des/codecs.js';
import { TableCodecs } from '@/src/documents/tables/ser-des/codecs.js';
import type { BaseDesCtx, BaseSerCtx } from '@/src/lib/api/ser-des/ctx.js';
import { NEVERMIND, SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';
import { $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { isBigNumber } from '@/src/lib/utils.js';
import { UnexpectedDataAPIResponseError } from '@/src/client/index.js';
import { TableSerDesCfgHandler } from '@/src/documents/tables/ser-des/cfg-handler.js';
import type { ParsedSerDesConfig } from '@/src/lib/api/ser-des/cfg-handler.js';
import { pathMatches } from '@/src/lib/api/ser-des/utils.js';
import type { SomeRow } from "@/src/documents/index.js";

/**
 * @beta
 */
export interface TableSerCtx extends BaseSerCtx<TableSerCtx> {
  bigNumsPresent: boolean,
}

/**
 * @beta
 */
export interface TableDesCtx extends BaseDesCtx<TableDesCtx> {
  tableSchema: ListTableColumnDefinitions,
}

/**
 * @beta
 */
export interface TableSerDesConfig extends BaseSerDesConfig<TableSerCtx, TableDesCtx> {
  sparseData?: boolean,
  codecs?: RawTableCodecs[],
}

/**
 * @internal
 */
export class TableSerDes extends SerDes<TableSerCtx, TableDesCtx> {
  declare protected readonly _cfg: ParsedSerDesConfig<TableSerDesConfig>;

  public static cfg: typeof TableSerDesCfgHandler = TableSerDesCfgHandler;

  public constructor(cfg: ParsedSerDesConfig<TableSerDesConfig>) {
    super(TableSerDes.cfg.concat([codecs, cfg]), serialize, deserialize);
  }

  protected override adaptSerCtx(ctx: TableSerCtx): TableSerCtx {
    ctx.bigNumsPresent = false;
    return ctx;
  }

  protected override adaptDesCtx(ctx: TableDesCtx): TableDesCtx {
    const rawDataApiResp = ctx.rawDataApiResp;
    const status = UnexpectedDataAPIResponseError.require(rawDataApiResp.status, 'No `status` found in response.', rawDataApiResp);

    if (ctx.target === SerDesTarget.InsertedId) {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.primaryKeySchema, 'No `status.primaryKeySchema` found in response.\n\n**Did you accidentally use a `Table` object on a Collection?** If so, your document was successfully inserted, but the client cannot properly deserialize the response. Please use a `Collection` object instead.', rawDataApiResp);
    } else {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.projectionSchema, 'No `status.projectionSchema` found in response.\n\n**Did you accidentally use a `Table` object on a Collection?** If so, documents may\'ve been found, but the client cannot properly deserialize the response. Please use a `Collection` object instead.', rawDataApiResp);
    }

    if (ctx.target === SerDesTarget.InsertedId) {
      ctx.rootObj = Object.fromEntries(Object.keys(ctx.tableSchema).map((key, i) => {
        return [key, ctx.rootObj[i]];
      }));
    }

    if (this._cfg.sparseData !== true) {
      populateSparseData(ctx);
    }

    return ctx;
  }

  protected override bigNumsPresent(ctx: TableSerCtx): boolean {
    return ctx.bigNumsPresent;
  }
}

const serialize: SerDesFn<TableSerCtx> = (value, ctx) => {
  let resp: ReturnType<SerDesFn<unknown>> = null!;

  // Path-based serializers
  for (const pathSer of ctx.serializers.forPath[ctx.path.length] ?? []) {
    if (pathMatches(pathSer.path, ctx.path) && pathSer.fns.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
      return resp;
    }
  }

  // Name-based serializers
  const key = ctx.path[ctx.path.length - 1] ?? '';
  const nameSer = ctx.serializers.forName[key];

  if (nameSer?.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
    return resp;
  }

  // Type-based & custom serializers
  for (const guardSer of ctx.serializers.forGuard) {
    if (guardSer.guard(value, ctx) && (resp = guardSer.fn(value, ctx))[0] !== NEVERMIND) {
      return resp;
    }
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return ctx.done(value.toString());
    }
  } else if (typeof value === 'object' && value !== null) {
    // Delegate serializer
    if (value[$SerializeForTable] && (resp = value[$SerializeForTable](ctx))[0] !== NEVERMIND) {
      return resp;
    }

    // Class-based serializers
    const classSer = ctx.serializers.forClass.find((c) => value instanceof c.class);

    if (classSer?.fns.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
      return resp;
    }

    // Enable using json-bigint
    if (isBigNumber(value)) {
      ctx.bigNumsPresent = true;
      return ctx.done();
    }
  } else if (typeof value === 'bigint') {
    ctx.bigNumsPresent = true;
  }

  return ctx.recurse();
};

const deserialize: SerDesFn<TableDesCtx> = (value, ctx) => {
  let resp: ReturnType<SerDesFn<unknown>> = null!;

  // Path-based deserializers
  for (const pathDes of ctx.deserializers.forPath[ctx.path.length] ?? []) {
    if (pathMatches(pathDes.path, ctx.path) && pathDes.fns.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
      return resp;
    }
  }

  // Name-based deserializers
  const key = ctx.path[ctx.path.length - 1] ?? '';
  const nameDes = ctx.deserializers.forName[key];

  if (nameDes?.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
    return resp;
  }

  // Custom deserializers
  for (const guardDes of ctx.deserializers.forGuard) {
    if (guardDes.guard(value, ctx) && (resp = guardDes.fn(value, ctx))[0] !== NEVERMIND) {
      return resp;
    }
  }

  if (ctx.path.length === 0 || value === null) {
    return ctx.recurse(value);
  }

  // Type-based deserializers
  const type = resolveAbsType(value, ctx);
  const typeDes = type && ctx.deserializers.forType[type];

  if (typeDes && typeDes.find((fns) => (resp = fns(value, ctx))[0] !== NEVERMIND)) {
    return resp;
  }

  return ctx.recurse(value);
};

const codecs = TableSerDes.cfg.parse({ codecs: Object.values(TableCodecs.Defaults) });

function populateSparseData(ctx: TableDesCtx) {
  for (const col in ctx.tableSchema) {
    const colIsPresent = Object.prototype.hasOwnProperty.call(ctx.rootObj, col);

    const typeDef = ctx.tableSchema[col] as any; // typeDef and type are linked, but we can't represent that in the type system :/
    const type = resolveType(typeDef);

    switch (type) {
      case 'map':
        if (!colIsPresent) {
          ctx.rootObj[col] = {};
        } else if (typeof typeDef === 'object' && typeDef.valueType.type === 'userDefined') {
          const value = ctx.rootObj[col];

          if (Array.isArray(value)) {
            for (const kv of value) {
              populateSparseUdt(kv[1], typeDef.valueType.definition);
            }
          } else {
            for (const v of Object.values(value)) {
              populateSparseUdt(v as SomeRow, typeDef.valueType.definition);
            }
          }
        }
        break;
      case 'set':
      case 'list':
        if (!colIsPresent) {
          ctx.rootObj[col] = [];
        } else if (typeof typeDef === 'object' && typeDef.valueType.type === 'userDefined') {
          ctx.rootObj[col].forEach((obj: any) => populateSparseUdt(obj, typeDef.valueType.definition));
        }
        break;
      case 'userDefined':
        ctx.rootObj[col] ??= {};
        populateSparseUdt(ctx.rootObj[col], typeDef.definition);
        break;
      default:
        if (!colIsPresent) {
          ctx.rootObj[col] = null;
        }
    }
  }
}

function populateSparseUdt(obj: SomeRow, def: ListTypeDefinition) {
  for (const col in def.fields) {
    if (!Object.prototype.hasOwnProperty.call(obj, col)) {
      obj[col] = null;
    }
  }
}

function resolveAbsType(value: unknown, { path, tableSchema }: TableDesCtx): string | undefined {
  let typeDef: any = tableSchema[path[0]];
  if (!typeDef) return undefined;

  let type = resolveType(typeDef);
  let depth = 1;

  while (depth < path.length && typeDef) {
    switch (type) {
      case 'map':
        if (path[depth + 1] === undefined) {
          return (!Array.isArray(value))
            ? typeDef.valueType
            : undefined;
        }

        typeDef = (path[depth + 1] === 0)
          ? typeDef.keyType
          : typeDef.valueType;

        type = resolveType(typeDef);
        depth += 2;
        break;
      case 'list':
      case 'set':
        typeDef = typeDef.valueType;
        type = resolveType(typeDef);
        depth++;
        break;
      case 'userDefined':
        typeDef = typeDef.definition.fields[path[depth]];
        if (!typeDef) return undefined;

        type = resolveType(typeDef);
        depth++;
        break;
      default:
        return type;
    }
  }

  return type;
}

function resolveType(column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition | string) {
  if (typeof column === 'string') {
    return column;
  }

  return (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;
}
