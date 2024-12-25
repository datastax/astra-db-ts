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

import { SomeDoc } from '@/src/documents';
import { BaseSerDesConfig, SerDes } from '@/src/lib/api/ser-des/ser-des';
import {
  ListTableColumnDefinitions,
  ListTableKnownColumnDefinition,
  ListTableUnsupportedColumnDefinition,
} from '@/src/db';
import { TableCodecs, TableCodecSerDesFns } from '@/src/documents/tables/ser-des/codecs';
import { BaseDesCtx, BaseSerCtx, CONTINUE } from '@/src/lib/api/ser-des/ctx';
import { $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import BigNumber from 'bignumber.js';
import { stringArraysEqual } from '@/src/lib/utils';
import { RawCodec } from '@/src/lib/api/ser-des/codecs';
import { UnexpectedDataAPIResponseError } from '@/src/client';

/**
 * @public
 */
export interface TableSerCtx extends BaseSerCtx<TableCodecSerDesFns> {
  bigNumsPresent: boolean,
}

/**
 * @public
 */
export interface TableDesCtx extends BaseDesCtx<TableCodecSerDesFns> {
  tableSchema: ListTableColumnDefinitions,
  populateSparseData: boolean,
  recurse: never;
}

/**
 * @public
 */
export type TableColumnTypeParser = (val: any, ctx: TableDesCtx, definition: SomeDoc) => any;

/**
 * @public
 */
export interface TableSerDesConfig extends BaseSerDesConfig<TableCodecSerDesFns, TableSerCtx, TableDesCtx> {
  codecs?: RawCodec<TableCodecSerDesFns>[],
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

  protected override adaptSerCtx(ctx: TableSerCtx): TableSerCtx {
    ctx.bigNumsPresent = false;
    return ctx;
  }

  protected override adaptDesCtx(ctx: TableDesCtx): TableDesCtx {
    const rawDataApiResp = ctx.rawDataApiResp;
    const status = UnexpectedDataAPIResponseError.require(rawDataApiResp.status, 'No `status` found in response.', rawDataApiResp);

    if (ctx.parsingInsertedId) {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.primaryKeySchema, 'No `status.primaryKeySchema` found in response.\n\n**Did you accidentally use a `Table` object on a collection?** If so, your document was successfully inserted, but the client cannot properly deserialize the response. Please use a `Collection` object instead.', rawDataApiResp);

      ctx.rootObj = Object.fromEntries(Object.keys(ctx.tableSchema).map((key, i) => {
        return [key, ctx.rootObj[i]];
      }));
    } else {
      ctx.tableSchema = UnexpectedDataAPIResponseError.require(status.projectionSchema, 'No `status.projectionSchema` found in response.\n\n**Did you accidentally use a `Table` object on a collection?** If so, documents may\'ve been found, but the client cannot properly deserialize the response. Please use a `Collection` object instead.', rawDataApiResp);
    }

    if (ctx.keyTransformer) {
      ctx.tableSchema = Object.fromEntries(Object.entries(ctx.tableSchema).map(([key, value]) => {
        return [ctx.keyTransformer!.deserializeKey(key, ctx), value];
      }));
    }

    (<any>ctx).recurse = () => { throw new Error('Table deserialization does not recurse normally; please call any necessary codecs manually'); };

    ctx.populateSparseData = this._cfg?.sparseData !== true;
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
  serialize(key, value, ctx) {
    const codecs = ctx.codecs;
    let resp;

    for (let i = 0, n = codecs.path.length; i < n; i++) {
      const path = codecs.path[i].path;

      if (stringArraysEqual(path, ctx.path)) {
        if ((resp = codecs.path[i].serialize?.(key, value, ctx) ?? ctx.continue())[0] !== CONTINUE) {
          return resp;
        }
      }
    }

    if (ctx.path.length === 1 && key in codecs.name) {
      if ((resp = codecs.name[key].serialize?.(key, value, ctx) ?? ctx.continue())[0] !== CONTINUE) {
        return resp;
      }
    }

    if (typeof value === 'number') {
      if (!isFinite(value)) {
        return ctx.done(value.toString());
      }
    } else if (typeof value === 'object' && value !== null) {
      if (value[$SerializeForTable]) {
        if ((resp = value[$SerializeForTable](ctx))[0] !== CONTINUE) {
          return resp;
        }
      }

      for (const codec of codecs.classGuard) {
        if (value instanceof codec.serializeClass) {
          if ((resp = codec.serialize(key, value, ctx))[0] !== CONTINUE) {
            return resp;
          }
        }
      }

      if (value instanceof BigNumber) {
        ctx.bigNumsPresent = true;
        return ctx.done();
      }
    } else if (typeof value === 'bigint') {
      ctx.bigNumsPresent = true;
    }

    for (const codec of codecs.customGuard) {
      if (codec.serializeGuard(value, ctx)) {
        if ((resp = codec.serialize(key, value, ctx))[0] !== CONTINUE) {
          return resp;
        }
      }
    }
    return ctx.continue();
  },
  deserialize(key, _, ctx) {
    const codecs = ctx.codecs;
    let resp;

    if (key === '' && Object.keys(ctx.rootObj).length === 0 && ctx.populateSparseData) {
      populateSparseData(ctx); // populate sparse data for empty objects
    }

    const column = ctx.tableSchema[key];

    for (let i = 0, n = codecs.path.length; i < n; i++) {
      const path = codecs.path[i].path;

      if (stringArraysEqual(path, ctx.path)) {
        if ((resp = codecs.path[i].deserialize?.(key, ctx.rootObj[key], ctx, column) ?? ctx.continue())[0] !== CONTINUE) {
          return resp;
        }
      }
    }

    if (key === '') {
      return ctx.continue();
    }

    if (ctx.populateSparseData) { // do at this level to avoid looping on newly-populated fields if done at the top level
      populateSparseData(ctx);
      ctx.populateSparseData = false;
    }

    const type = resolveType(column);

    if (key in codecs.name) {
      if ((resp = codecs.name[key].deserialize(key, ctx.rootObj[key], ctx, column))[0] !== CONTINUE) {
        return resp;
      }
    }

    if (type in codecs.type) {
      if ((resp = codecs.type[type].deserialize(key, ctx.rootObj[key], ctx, column))[0] !== CONTINUE) {
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
