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

import { ok, p, Parser } from '@/src/lib/validation';
import { DbSpawnOptions } from '@/src/client';
import { TokenProvider } from '@/src/lib';

export const parseDbSpawnOpts: Parser<DbSpawnOptions | undefined> = p.do(function* (raw, field) {
  const opts = yield* p.parse('object?')(raw, field);

  if (!opts) {
    return ok(undefined);
  }

  return ok({
    keyspace: yield* p.parse('string?')(opts.keyspace, `${field}.keyspace`),
    dataApiPath: yield* p.parse('string?')(opts.dataApiPath, `${field}.dataApiPath`),
    token: yield* TokenProvider.parseToken(opts.token, `${field}.token`),
  });
});
