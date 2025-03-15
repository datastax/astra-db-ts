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

import type { OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler.js';
import { OptionsHandler } from '@/src/lib/opts-handler.js';
import type { DataAPIClient, DataAPIClientOptions } from '@/src/client/index.js';
import { TokenProvider } from '@/src/lib/index.js';
import { exact } from 'decoders';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import { InternalLogger } from '@/src/lib/logging/internal-logger.js';
import { EnvironmentCfgHandler } from '@/src/client/opts-handlers/environment-cfg-handler.js';
import { CallerCfgHandler } from '@/src/client/opts-handlers/caller-cfg-handler.js';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler.js';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler.js';
import { HttpOptsHandler } from '@/src/client/opts-handlers/http-opts-handler.js';

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: ParsedRootClientOpts,
  Parseable: DataAPIClientOptions,
}

/**
 * @internal
 */
export interface ParsedRootClientOpts extends Parsed<'DataAPIClientOptions'> {
  environment: typeof EnvironmentCfgHandler.parsed,
  client: DataAPIClient,
  fetchCtx: typeof HttpOptsHandler.parsed,
  caller: typeof CallerCfgHandler.parsed,
  dbOptions: typeof DbOptsHandler.parsed,
  adminOptions: typeof AdminOptsHandler.parsed,
  dbAndAdminCommon: {
    timeoutDefaults: typeof Timeouts.cfg.parsed,
    logging: typeof InternalLogger.cfg.parsed,
  },
}

/**
 * @internal
 */
const decoder = exact({
  logging: InternalLogger.cfg.decoder,
  environment: EnvironmentCfgHandler.decoder,
  httpOptions: HttpOptsHandler.decoder,
  dbOptions: DbOptsHandler.decoder,
  adminOptions: AdminOptsHandler.decoder,
  caller: CallerCfgHandler.decoder,
  timeoutDefaults: Timeouts.cfg.decoder,
});

/**
 * @internal
 */
export const RootOptsHandler = (defaultToken: typeof TokenProvider.opts.parsed, client: DataAPIClient) => {
  const transformer = decoder.transform((input) => {
    const dbAndAdminCommon = {
      timeoutDefaults: input.timeoutDefaults,
      logging: input.logging,
    };

    return {
      environment: input.environment,
      fetchCtx: input.httpOptions,
      caller: input.caller,
      client: client,
      dbOptions: DbOptsHandler.concat([input.dbOptions, {
        ...DbOptsHandler.empty,
        token: TokenProvider.opts.concat([defaultToken, input.dbOptions.token]),
        ...dbAndAdminCommon,
      }]),
      adminOptions: AdminOptsHandler.concat([input.adminOptions, {
        ...AdminOptsHandler.empty,
        adminToken: TokenProvider.opts.concat([defaultToken, input.adminOptions.adminToken]),
        ...dbAndAdminCommon,
      }]),
      dbAndAdminCommon,
    };
  });

  return new OptionsHandler<Types>(transformer);
};
