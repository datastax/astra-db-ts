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

import { p, Parser } from '@/src/lib/validation';
import { DbSerDesConfig, DbSpawnOptions } from '@/src/client';
import { TokenProvider } from '@/src/lib';
import { isNullish } from '@/src/lib/utils';
import { Logger } from '@/src/lib/logging/logger';
import { CollectionSerDesConfig, SomeDoc, TableColumnTypeParser, TableSerDesConfig } from '@/src/documents';
import { Timeouts } from '@/src/lib/api/timeouts';

export const parseDbSpawnOpts: Parser<DbSpawnOptions | undefined, unknown> = (raw, field) => {
  const opts = p.parse('object?')<DbSpawnOptions>(raw, field);

  if (!opts) {
    return undefined;
  }

  return {
    logging: Logger.parseConfig(opts.logging, `${field}.logging`),
    keyspace: p.parse('string?', validateKeyspace)(opts.keyspace, `${field}.keyspace`),
    dataApiPath: p.parse('string?')(opts.dataApiPath, `${field}.dataApiPath`),
    token: TokenProvider.parseToken([opts.token], `${field}.token`),
    serdes: p.parse('object?', parseSerDes)(opts.serdes, `${field}.serDes`),
    additionalHeaders: p.parse('object?')(opts.additionalHeaders, `${field}.additionalHeaders`),
    timeoutDefaults: Timeouts.parseConfig(opts.timeoutDefaults, `${field}.timeoutDefaults`),
  };
};

const parseSerDes: Parser<DbSerDesConfig> = (cfg, field) => ({
  table: p.parse('object?', parseTableSerDes)(cfg.table, `${field}.table`),
  collection: p.parse('object?', parseCollectionSerDes)(cfg.collection, `${field}.collection`),
  mutateInPlace: p.parse('boolean?')(cfg.mutateInPlace, `${field}.mutateInPlace`),
});

const parseTableSerDes: Parser<TableSerDesConfig<SomeDoc>> = (cfg, field) => ({
  serialize: p.parse('function?')(cfg.serialize, `${field}.serialize`),
  deserialize: p.parse('function?')(cfg.deserialize, `${field}.deserialize`),
  parsers: p.parse('object?', parseTableColumnTypeParser)(cfg.parsers, `${field}.parsers`),
  mutateInPlace: p.parse('boolean?')(cfg.mutateInPlace, `${field}.mutateInPlace`),
  sparseData: p.parse('boolean?')(cfg.sparseData, `${field}.sparseData`),
});

const parseCollectionSerDes: Parser<CollectionSerDesConfig<SomeDoc>> = (cfg, field) => ({
  serialize: p.parse('function?')(cfg.serialize, `${field}.serialize`),
  deserialize: p.parse('function?')(cfg.deserialize, `${field}.deserialize`),
  mutateInPlace: p.parse('boolean?')(cfg.mutateInPlace, `${field}.mutateInPlace`),
  enableBigNumbers: p.parse('boolean?')(cfg.enableBigNumbers, `${field}.enableBigNumbers`),
});

const parseTableColumnTypeParser: Parser<Record<string, TableColumnTypeParser>, Record<string, unknown>> = (raw, field) => {
  const parsers = Object.entries(raw).map(([key, value]) => {
    return [
      p.parse('string!')(key, `key ${field}.${key}`),
      p.parse('function!')(value, `${field}.${key}`),
    ];
  });
  return Object.fromEntries(parsers);
};

const validateKeyspace = (keyspace: string | undefined, field: string) => {
  if (isNullish(keyspace)) {
    return undefined;
  }
  if (!keyspace.match(/^\w{1,48}$/)) {
    throw new Error(`Invalid ${field}; expected a string of 1-48 alphanumeric characters`);
  }
  return keyspace;
};
