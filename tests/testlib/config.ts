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

import * as process from 'node:process';
import type { BaseClientEvent, DataAPIEnvironment } from '@/src/lib/index.js';
import { DEFAULT_KEYSPACE } from '@/src/lib/index.js';
import type { DecoderType } from 'decoders';
import { array, boolean, exact, object, oneOf, optional, positiveInteger, string } from 'decoders';
import { jsonTryParse } from '@/src/lib/utils.js';
import { FilterBuilder, VecWhitelistBuilder } from '@/tests/testlib/config-builders.js';

const RawTestCfgDecoder = exact({
  DbEnvironment: optional(string),

  HttpClient: optional(string),

  TestTimeout: optional(positiveInteger),

  LoggingPredicate: optional(string),

  SkipPrelude: optional(boolean),

  Filter: optional(object({
    Parts: optional(array(string)),
    Combinator: optional(oneOf(['and', 'or'] as const)),
  })),

  VectorizeWhitelist: optional(object({
    Whitelist: optional(string),
    Inverted: optional(boolean),
  })),

  RunTests: optional(object({
    Vectorize: optional(boolean),
    LongRunning: optional(boolean),
    Admin: optional(boolean),
  })),
});

export type RawTestCfg = DecoderType<typeof RawTestCfgDecoder>;

const TestCfgDecoder = RawTestCfgDecoder
  .transform((v) => ({
    DbEnvironment: v.DbEnvironment as DataAPIEnvironment ?? 'astra',

    HttpClient: optional(oneOf(['fetch-h2:http2', 'fetch-h2:http1', 'fetch'] as const), 'fetch-h2:http2').verify(v.HttpClient),

    TestTimeout: v.TestTimeout ?? 90000,

    LoggingPredicate: {
      test: new Function('e', 'isGlobal', 'return ' + (v.LoggingPredicate ?? 'false')) as (e: BaseClientEvent, isGlobal: boolean) => boolean,
    },

    SkipPrelude: v.SkipPrelude ?? false,

    Filter: new FilterBuilder(v.Filter?.Parts ?? [], v.Filter?.Combinator ?? 'and').build(),

    VectorizeWhitelist: new VecWhitelistBuilder(v.VectorizeWhitelist?.Whitelist ?? '$model-limit:1', v.VectorizeWhitelist?.Inverted ?? false).build(),

    RunTests: {
      Vectorize: v.RunTests?.Vectorize ?? true,
      LongRunning: v.RunTests?.LongRunning ?? false,
      Admin: v.RunTests?.Admin ?? false,
    },
  }))
  .transform((v) => {
    if (!process.env.CLIENT_DB_URL || !process.env.CLIENT_DB_TOKEN || !process.env.CLIENT_EMBEDDING_API_KEY) {
      throw new Error('Please ensure the CLIENT_DB_URL and CLIENT_DB_TOKEN and CLIENT_EMBEDDING_API_KEY env vars are set');
    }

    return {
      ...v,
      DbUrl: process.env.CLIENT_DB_URL,
      DbToken: process.env.CLIENT_DB_TOKEN,
      EmbeddingAPIKey: process.env.CLIENT_EMBEDDING_API_KEY,
    };
  })
  .transform((v => ({
    ...v,

    TempDbName: 'astra-test-db-plus-random-name-1284',

    DefaultCollectionName: 'test_coll',
    DefaultTableName: 'test_table',

    DefaultKeyspace: DEFAULT_KEYSPACE,
    OtherKeyspace: 'other_keyspace',

    VectorizeVectorLength: 1024,
  })));

export const Cfg = TestCfgDecoder.verify(jsonTryParse(process.env.CLIENT_TEST_CONFIG!, {}));
