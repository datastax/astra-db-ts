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
  processCodecs,
  RawTableCodec,
  TableCodecs,
  TableCodecSerDesFns,
  TableDeserializers,
  TableSerializers,
} from '@/src/documents/tables/ser-des/codecs';
import { BaseDesCtx, BaseSerCtx, CONTINUE } from '@/src/lib/api/ser-des/ctx';
import { $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { isBigNumber } from '@/src/lib/utils';
import { UnexpectedDataAPIResponseError } from '@/src/client';

/**
 * @public
 */
export interface TableSerCtx extends BaseSerCtx<TableCodecSerDesFns> {
  serializers: TableSerializers,
  bigNumsPresent: boolean,
}

/**
 * @public
 */
export interface TableDesCtx extends BaseDesCtx<TableCodecSerDesFns> {
  tableSchema: ListTableColumnDefinitions,
  deserializers: TableDeserializers,
  next: never;
}

/**
 * @public
 */
export interface TableSerDesConfig extends BaseSerDesConfig<TableCodecSerDesFns, TableSerCtx, TableDesCtx> {
  codecs?: RawTableCodec[],
  sparseData?: boolean,
}

/**
 * @internal
 */
export class TableSerDes extends SerDes<TableCodecSerDesFns, TableSerCtx, TableDesCtx> {
  declare protected readonly _cfg: TableSerDesConfig;
  
  private readonly _serializers: TableSerializers;
  private readonly _deserializers: TableDeserializers;

  public constructor(cfg?: TableSerDesConfig) {
    super(TableSerDes.mergeConfig(DefaultTableSerDesCfg, cfg));
    [this._serializers, this._deserializers] = processCodecs(this._cfg.codecs ?? []);
  }

  protected override adaptSerCtx(ctx: TableSerCtx): TableSerCtx {
    ctx.bigNumsPresent = false;
    ctx.serializers = this._serializers;
    return ctx;
  }

  protected override adaptDesCtx(ctx: TableDesCtx): TableDesCtx {
    const rawDataApiResp = ctx.rawDataApiResp;
    const status = UnexpectedDataAPIResponseError.require(rawDataApiResp.status, 'No `status` found in response.', rawDataApiResp);

    if (ctx.parsingInsertedId) {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.primaryKeySchema, 'No `status.primaryKeySchema` found in response.\n\n**Did you accidentally use a `Table` object on a Tableection?** If so, your document was successfully inserted, but the client cannot properly deserialize the response. Please use a `Tableection` object instead.', rawDataApiResp);

      ctx.rootObj = Object.fromEntries(Object.keys(ctx.tableSchema).map((key, i) => {
        return [key, ctx.rootObj[i]];
      }));
    } else {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.projectionSchema, 'No `status.projectionSchema` found in response.\n\n**Did you accidentally use a `Table` object on a Tableection?** If so, documents may\'ve been found, but the client cannot properly deserialize the response. Please use a `Tableection` object instead.', rawDataApiResp);
    }

    if (this._cfg?.sparseData !== true) {
      populateSparseData(ctx);
    }

    if (ctx.keyTransformer) {
      ctx.tableSchema = Object.fromEntries(Object.entries(ctx.tableSchema).map(([key, value]) => {
        return [ctx.keyTransformer!.deserializeKey(key, ctx), value];
      }));
    }

    (<any>ctx).recurse = () => { throw new Error('Table deserialization does not recurse normally; please call any necessary codecs manually'); };

    ctx.deserializers = this._deserializers;
    return ctx;
  }

  protected override bigNumsPresent(ctx: TableSerCtx): boolean {
    return ctx.bigNumsPresent;
  }

  public static mergeConfig(...cfg: (TableSerDesConfig | undefined)[]): TableSerDesConfig {
    return {
      sparseData: cfg.reduce<boolean | undefined>((acc, c) => c?.sparseData ?? acc, undefined),
      codecs: cfg.reduce<TableSerDesConfig['codecs']>((acc, c) => [...c?.codecs ?? [], ...acc!], []),
      ...super._mergeConfig(...cfg),
    };
  }
}

const DefaultTableSerDesCfg = {
  serialize(key, value, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    // Name-based serializers
    const nameSer = ctx.serializers.forName[key];

    if (nameSer && nameSer.find((ser) => (resp = ser(key, value, ctx))[0] !== CONTINUE)) {
      return resp;
    }

    // Type-based/custom serializers
    const guardSer = ctx.serializers.forGuard.find((g) => g.guard(value, ctx));

    if (guardSer && (resp = guardSer.fn(key, value, ctx))[0] !== CONTINUE) {
      return resp;
    }

    if (typeof value === 'number') {
      if (!isFinite(value)) {
        return ctx.done(value.toString());
      }
    } else if (typeof value === 'object' && value !== null) {
      // Delegate serializer
      if ($SerializeForTable in value && (resp = value[$SerializeForTable](ctx))[0] !== CONTINUE) {
        return resp;
      }

      // Class-based serializers
      const classSer = ctx.serializers.forClass.find((c) => value instanceof c.class);

      if (classSer && classSer.fns.find((ser) => (resp = ser(key, value, ctx))[0] !== CONTINUE)) {
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

    return ctx.continue();
  },
  deserialize(key, _, ctx) {
    let resp: ReturnType<SerDesFn<unknown>> = null!;

    const column = ctx.tableSchema[key];
    const value = ctx.rootObj[key];

    // Name-based deserializers
    const nameDes = ctx.deserializers.forName[key];

    if (nameDes && nameDes.find((des) => (resp = des(key, value, ctx, column))[0] !== CONTINUE)) {
      return resp;
    }

    // Custom deserializers
    const guardDes = ctx.deserializers.forGuard.find((g) => g.guard(value, ctx));

    if (guardDes && (resp = guardDes.fn(key, value, ctx, column))[0] !== CONTINUE) {
      return resp;
    }

    if (key === '') {
      return ctx.continue();
    }

    // Type-based deserializers
    const type = resolveType(column);

    if (value !== null && type) {
      const typeDes = ctx.deserializers.forType[type];

      if (typeDes && typeDes.find((des) => (resp = des(key, value, ctx, column))[0] !== CONTINUE)) {
        return resp;
      }
    }

    return ctx.done();
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

function resolveType(column: ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition) {
  return (column.type === 'UNSUPPORTED')
    ? column.apiSupport.cqlDefinition
    : column.type;
}
