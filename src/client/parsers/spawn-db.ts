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
import { DbOptions, DbSerDesConfig } from '@/src/client';
import { TokenProvider } from '@/src/lib';
import { isNullish } from '@/src/lib/utils';
import { Logger } from '@/src/lib/logging/logger';
import { Timeouts } from '@/src/lib/api/timeouts';

/**
 * @internal
 */
export const parseDbSpawnOpts: Parser<DbOptions | undefined, unknown> = (raw, field) => {
  const opts = p.parse('object?')<DbOptions>(raw, field);

  if (!opts) {
    return undefined;
  }

  return {
    logging: Logger.cfg.parseWithin(opts, `${field}.logging`),
    keyspace: p.parse('string?', validateKeyspace)(opts.keyspace, `${field}.keyspace`),
    dataApiPath: p.parse('string?')(opts.dataApiPath, `${field}.dataApiPath`),
    token: TokenProvider.opts.parseWithin(opts, `${field}.token`),
    serdes: p.parse('object?', parseSerDes)(opts.serdes, `${field}.serDes`),
    additionalHeaders: p.parse('object?')(opts.additionalHeaders, `${field}.additionalHeaders`),
    timeoutDefaults: Timeouts.parseConfig(opts.timeoutDefaults, `${field}.timeoutDefaults`),
  };
};

const parseSerDes: Parser<DbSerDesConfig> = (cfg, field) => ({
  table: p.parse('object?')(cfg.table, `${field}.table`),
  collection: p.parse('object?')(cfg.collection, `${field}.collection`),
  mutateInPlace: p.parse('boolean?')(cfg.mutateInPlace, `${field}.mutateInPlace`),
});

const validateKeyspace = (keyspace: string | undefined, field: string) => {
  if (isNullish(keyspace)) {
    return undefined;
  }
  if (!keyspace.match(/^\w{1,48}$/)) {
    throw new Error(`Invalid ${field}; expected a string of 1-48 alphanumeric characters`);
  }
  return keyspace;
};
