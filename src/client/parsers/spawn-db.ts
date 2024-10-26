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
import { DbSpawnOptions, Logger } from '@/src/client';
import { TokenProvider } from '@/src/lib';
import { isNullish } from '@/src/lib/utils';

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
  };
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
