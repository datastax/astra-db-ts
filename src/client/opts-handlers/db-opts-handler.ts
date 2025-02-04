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

import { MonoidalOptionsHandler, monoids, MonoidType, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler';
import { DbOptions } from '@/src/client';
import { TokenProvider } from '@/src/lib';
import { exact, nullish, oneOf, optional, record, regex, string } from 'decoders';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts';
import { Logger } from '@/src/lib/logging/logger';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des';

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: ParsedDbOptions,
  Parseable: DbOptions | undefined | null,
}

/**
 * @internal
 */
export type ParsedDbOptions = MonoidType<typeof monoid> & Parsed<'DbOptions'>;

/**
 * @internal
 */
const monoid = monoids.object({
  logging: Logger.cfg,
  token: TokenProvider.opts,
  keyspace: monoids.optional<string>(),
  dataApiPath: monoids.optional<string>(),
  collSerdes: CollSerDes.cfg,
  tableSerdes: TableSerDes.cfg,
  additionalHeaders: monoids.record<string>(),
  timeoutDefaults: Timeouts.cfg,
});

/**
 * @internal
 */
const decoder = nullish(exact({
  logging: Logger.cfg.decoder,
  token: TokenProvider.opts.decoder,
  dataApiPath: optional(string),
  additionalHeaders: optional(record(string)),
  keyspace: optional(regex(/^\w{1,48}$/, 'Expected a string of 1-48 alphanumeric characters')),
  timeoutDefaults: Timeouts.cfg.decoder,
  serdes: optional(exact({
    collection: CollSerDes.cfg.decoder,
    table: TableSerDes.cfg.decoder,
    mutateInPlace: optional(oneOf(<const>[true, false])),
  })),
}));

/**
 * @internal
 */
const transformer = decoder.transform((input) => {
  if (!input) {
    return monoid.empty;
  }

  if (input.serdes) {
    input.serdes.collection.mutateInPlace ??= input.serdes.mutateInPlace;
    input.serdes.table.mutateInPlace ??= input.serdes.mutateInPlace;
  }

  return {
    ...input,
    keyspace: input.keyspace,
    dataApiPath: input.dataApiPath,
    collSerdes: input.serdes?.collection ?? CollSerDes.cfg.empty,
    tableSerdes: input.serdes?.table ?? TableSerDes.cfg.empty,
    additionalHeaders: input.additionalHeaders ?? {},
  };
});

/**
 * @internal
 */
export const DbOptsHandler = new MonoidalOptionsHandler<Types>(transformer, monoid);
