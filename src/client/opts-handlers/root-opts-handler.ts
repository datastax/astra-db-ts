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

import { DecoderType, OptionsHandler, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler';
import { DataAPIClientOptions, DataAPIClient } from '@/src/client';
import { type DataAPIClientEventMap, TokenProvider } from '@/src/lib';
import { object, optional } from 'decoders';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts';
import { Logger } from '@/src/lib/logging/logger';
import { EnvironmentCfgHandler } from '@/src/client/opts-handlers/environment-cfg-handler';
import type TypedEmitter from 'typed-emitter';
import { CallerCfgHandler } from '@/src/client/opts-handlers/caller-cfg-handler';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler';
import { HttpOptsHandler } from '@/src/client/opts-handlers/http-opts-handler';

/**
 * @internal
 */
export interface ParsedRootClientOpts extends Parsed<'DataAPIClientOptions'> {
  environment: typeof EnvironmentCfgHandler.parsed,
  emitter: TypedEmitter<DataAPIClientEventMap>,
  fetchCtx: typeof HttpOptsHandler.parsed,
  caller: typeof CallerCfgHandler.parsed,
  dbOptions: typeof DbOptsHandler.parsed,
  adminOptions: typeof AdminOptsHandler.parsed,
}

/**
 * @internal
 */
interface RootOptsTypes extends OptionsHandlerTypes {
  Parsed: ParsedRootClientOpts,
  Parseable: DataAPIClientOptions | undefined,
  Decoded: DecoderType<typeof rootOpts>,
}

const rootOpts = optional(object({
  logging: Logger.cfg.decoder,
  environment: EnvironmentCfgHandler.decoder,
  httpOptions: HttpOptsHandler.decoder,
  dbOptions: DbOptsHandler.decoder,
  adminOptions: AdminOptsHandler.decoder,
  caller: CallerCfgHandler.decoder,
  timeoutDefaults: Timeouts.cfg.decoder,
}));

/**
 * @internal
 */
export const RootOptsHandler = (defaultToken: typeof TokenProvider.opts.parsed, client: DataAPIClient) => new OptionsHandler<RootOptsTypes>({
  decoder: rootOpts,
  refine(options, field) {
    const dbOptions = DbOptsHandler.parseWithin(options, `${field}.dbOptions`);
    const adminOptions = AdminOptsHandler.parse(options, `${field}.adminOptions`);

    return {
      environment: EnvironmentCfgHandler.parseWithin(options, `${field}.environment`),
      fetchCtx: HttpOptsHandler.parseWithin(options, `${field}.httpOptions`),
      dbOptions: DbOptsHandler.concatParse([dbOptions], {
        token: TokenProvider.opts.concat(defaultToken, dbOptions.token),
        timeoutDefaults: options?.timeoutDefaults,
        logging: options?.logging,
      }),
      adminOptions: AdminOptsHandler.concatParse([adminOptions], {
        adminToken: TokenProvider.opts.concat(defaultToken, adminOptions.adminToken),
        timeoutDefaults: options?.timeoutDefaults,
        logging: options?.logging,
      }),
      emitter: client,
      caller: CallerCfgHandler.parseWithin(options, 'caller'),
    };
  },
});
