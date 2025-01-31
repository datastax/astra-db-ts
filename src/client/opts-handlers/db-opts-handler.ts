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

import { DecoderType, MonoidalOptionsHandler, OptionsHandlerTypes, Parsed, Unparse } from '@/src/lib/opts-handler';
import { DbOptions } from '@/src/client';
import { TokenProvider } from '@/src/lib';
import { Decoder, nullish, object, oneOf, optional, record, regex, string, unknown } from 'decoders';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts';
import { Logger } from '@/src/lib/logging/logger';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des';

/**
 * @internal
 */
export interface ParsedDbOptions extends Parsed<'DbOptions'> {
  logging: typeof Logger.cfg.parsed,
  token: typeof TokenProvider.opts.parsed,
  keyspace: string | undefined,
  dataApiPath: string | undefined,
  collSerdes: typeof CollSerDes.cfg.parsed,
  tableSerdes: typeof TableSerDes.cfg.parsed,
  additionalHeaders: Record<string, string>,
  timeoutDefaults: typeof Timeouts.cfg.parsed,
}

/**
 * @internal
 */
interface DbOptsTypes extends OptionsHandlerTypes {
  Parsed: ParsedDbOptions,
  Parseable: DbOptions | null | undefined,
  Decoded: DecoderType<typeof dbOpts>,
}

const dbOpts = nullish(object({
  logging: Logger.cfg.decoder,
  token: TokenProvider.opts.decoder,
  dataApiPath: optional(string),
  additionalHeaders: optional(record(string)),
  keyspace: nullish(regex(/^\w{1,48}$/, 'Expected a string of 1-48 alphanumeric characters')),
  timeoutDefaults: Timeouts.cfg.decoder,
  serdes: optional(object({
    collection: unknown as Decoder<any>,
    table: unknown as Decoder<any>,
    mutateInPlace: optional(oneOf(<const>[true, false])),
  })),
}));

/**
 * @internal
 */
export const DbOptsHandler = new MonoidalOptionsHandler<DbOptsTypes>({
  decoder: dbOpts,
  refine(input, field) {
    const mutateInPlace = input?.serdes?.mutateInPlace;

    const tableSerdes = TableSerDes.cfg.parseWithin<'table'>(input?.serdes, `${field}.serdes.table`);
    tableSerdes.mutateInPlace = mutateInPlace ?? tableSerdes.mutateInPlace;

    const collSerdes = CollSerDes.cfg.parseWithin<'collection'>(input?.serdes, `${field}.serdes.collection`);
    collSerdes.mutateInPlace = mutateInPlace ?? collSerdes.mutateInPlace;

    return {
      logging: Logger.cfg.parseWithin(input, `${field}.logging`),
      token: TokenProvider.opts.parseWithin(input, `${field}.token`),
      keyspace: input?.keyspace ?? undefined,
      dataApiPath: input?.dataApiPath ?? undefined,
      collSerdes: collSerdes,
      tableSerdes: tableSerdes,
      additionalHeaders: input?.additionalHeaders ?? {},
      timeoutDefaults: Timeouts.cfg.parseWithin(input, `${field}.timeoutDefaults`),
    };
  },
  concat(configs): Unparse<ParsedDbOptions> {
    return configs.reduce<Unparse<ParsedDbOptions>>((acc, next) => ({
      logging: Logger.cfg.concat(acc.logging, next.logging),
      token: TokenProvider.opts.concat(acc.token, next.token),
      keyspace: next.keyspace ?? acc.keyspace,
      dataApiPath: next.dataApiPath ?? acc.dataApiPath,
      collSerdes: CollSerDes.cfg.concat(acc.collSerdes, next.collSerdes),
      tableSerdes: TableSerDes.cfg.concat(acc.tableSerdes, next.tableSerdes),
      additionalHeaders: { ...acc.additionalHeaders, ...next.additionalHeaders },
      timeoutDefaults: Timeouts.cfg.concat(acc.timeoutDefaults, next.timeoutDefaults),
    }), DbOptsHandler.empty);
  },
  empty: {
    logging: Logger.cfg.empty,
    token: TokenProvider.opts.empty,
    keyspace: undefined,
    dataApiPath: undefined,
    collSerdes: CollSerDes.cfg.empty,
    tableSerdes: TableSerDes.cfg.empty,
    additionalHeaders: {},
    timeoutDefaults: Timeouts.cfg.empty,
  },
});
