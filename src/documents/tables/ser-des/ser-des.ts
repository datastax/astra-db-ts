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

import { BaseSerDesConfig, SerDes, SerDesFn } from '@/src/lib/api/ser-des/ser-des';
import {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
} from '@/src/db';
import {
  RawTableCodecs,
  TableCodecs,
} from '@/src/documents/tables/ser-des/codecs';
import { BaseDesCtx, BaseSerCtx, NEVERMIND } from '@/src/lib/api/ser-des/ctx';
import { $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { isBigNumber, pathMatches } from '@/src/lib/utils';
import { UnexpectedDataAPIResponseError } from '@/src/client';

/**
 * @public
 */
export interface TableSerCtx extends BaseSerCtx<TableSerCtx> {
  bigNumsPresent: boolean,
}

/**
 * @public
 */
export interface TableDesCtx extends BaseDesCtx<TableDesCtx> {
  tableSchema: ListTableColumnDefinitions,
}

/**
 * @public
 */
export interface TableSerDesConfig extends BaseSerDesConfig<TableSerCtx, TableDesCtx> {
  codecs?: RawTableCodecs[],
  sparseData?: boolean,
}

/**
 * @internal
 */
export class TableSerDes extends SerDes<TableSerCtx, TableDesCtx> {
  declare protected readonly _cfg: TableSerDesConfig;

  public constructor(cfg?: TableSerDesConfig) {
    super(TableSerDes.mergeConfig(DefaultTableSerDesCfg, cfg));
  }

  protected override adaptSerCtx(ctx: TableSerCtx): TableSerCtx {
    ctx.bigNumsPresent = false;
    return ctx;
  }

  protected override adaptDesCtx(ctx: TableDesCtx): TableDesCtx {
    const rawDataApiResp = ctx.rawDataApiResp;
    const status = UnexpectedDataAPIResponseError.require(rawDataApiResp.status, 'No `status` found in response.', rawDataApiResp);

    if (ctx.parsingInsertedId) {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.primaryKeySchema, 'No `status.primaryKeySchema` found in response.\n\n**Did you accidentally use a `Table` object on a Collection?** If so, your document was successfully inserted, but the client cannot properly deserialize the response. Please use a `Collection` object instead.', rawDataApiResp);

      ctx.rootObj = Object.fromEntries(Object.keys(ctx.tableSchema).map((key, i) => {
        return [key, ctx.rootObj[i]];
      }));
    } else {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.projectionSchema, 'No `status.projectionSchema` found in response.\n\n**Did you accidentally use a `Table` object on a Collection?** If so, documents may\'ve been found, but the client cannot properly deserialize the response. Please use a `Collection` object instead.', rawDataApiResp);
    }

    if (this._cfg?.sparseData !== true) {
      populateSparseData(ctx);
    }

    if (ctx.keyTransformer) {
      ctx.tableSchema = Object.fromEntries(Object.entries(ctx.tableSchema).map(([key, value]) => {
        return [ctx.keyTransformer!.deserializeKey(key, ctx), value];
      }));
    }

    return ctx;
  }

  protected override bigNumsPresent(ctx: TableSerCtx): boolean {
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
  serialize(value, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    // Path-based serializers
    for (const pathSer of ctx.serializers.forPath[ctx.path.length] ?? []) {
      if (pathMatches(pathSer.path, ctx.path) && pathSer.fns.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== NEVERMIND; })) {
        return resp;
      }
    }

    // Name-based serializers
    const key = ctx.path[ctx.path.length - 1] ?? '';
    const nameSer = ctx.serializers.forName[key];

    if (nameSer && nameSer.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== NEVERMIND; })) {
      return resp;
    }

    // Type-based & custom serializers
    for (const guardSer of ctx.serializers.forGuard) {
      if (guardSer.guard(value, ctx)) {
        const resp = guardSer.fn(value, ctx);
        (resp.length === 2) && (value = resp[1]);

        if (resp[0] !== NEVERMIND) {
          return resp;
        }
      }
    }

    if (typeof value === 'number') {
      if (!isFinite(value)) {
        return ctx.done(value.toString());
      }
    } else if (typeof value === 'object' && value !== null) {
      // Delegate serializer
      if ($SerializeForTable in value && (resp = value[$SerializeForTable](ctx))[0] !== NEVERMIND) {
        return resp;
      }

      // Class-based serializers
      const classSer = ctx.serializers.forClass.find((c) => value instanceof c.class);

      if (classSer && classSer.fns.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== NEVERMIND; })) {
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

    return ctx.nevermind();
  },
  deserialize(value, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    // Path-based deserializers
    for (const pathSer of ctx.deserializers.forPath[ctx.path.length] ?? []) {
      if (pathMatches(pathSer.path, ctx.path) && pathSer.fns.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== NEVERMIND; })) {
        return resp;
      }
    }

    // Name-based deserializers
    const key = ctx.path[ctx.path.length - 1] ?? '';
    const nameDes = ctx.deserializers.forName[key];

    if (nameDes && nameDes.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== NEVERMIND; })) {
      return resp;
    }

    // Custom deserializers
    for (const guardDes of ctx.deserializers.forGuard) {
      if (guardDes.guard(value, ctx)) {
        const resp = guardDes.fn(value, ctx);
        (resp.length === 2) && (value = resp[1]);

        if (resp[0] !== NEVERMIND) {
          return resp;
        }
      }
    }

    if (key === '' || value === null) {
      return ctx.nevermind();
    }

    // Type-based deserializers
    const type = resolveAbsType(ctx);
    const typeDes = type && ctx.deserializers.forType[type];

    if (typeDes && typeDes.find((fns) => { resp = fns(value, ctx); if (resp.length === 2) value = resp[1]; return resp[0] !== NEVERMIND; })) {
      return resp;
    }

    return ctx.nevermind();
  },
  codecs: Object.values(TableCodecs.Defaults),
} satisfies TableSerDesConfig;

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

function resolveAbsType({ path, tableSchema }: TableDesCtx): string | undefined {
  const column = tableSchema[path[0]];
  const type = column ? resolveType(column) : undefined;

  if (path.length === 1 || !column) {
    return type;
  }

  if (type === 'map') {
    if (typeof path[1] === 'number') {
      if (path.length === 3) {
        return (path[2] === 0 ? (column as any).keyType : (column as any).valueType);
      }
    } else if (path.length === 2) {
      return (column as any).valueType;
    }
  }
  else if ((type === 'set' || type === 'list') && path.length === 2) {
    return (column as any).valueType;
  }

  return undefined;
}

function resolveType(column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) {
  return (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;
}
