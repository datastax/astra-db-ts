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

import type { MonoidType, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler.js';
import { MonoidalOptionsHandler, monoids } from '@/src/lib/opts-handler.js';
import type { AdminOptions } from '@/src/client/index.js';
import { TokenProvider } from '@/src/lib/index.js';
import { exact, nullish, oneOf, optional, record, string } from 'decoders';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import { InternalLogger } from '@/src/lib/logging/internal-logger.js';
import { EnvironmentCfgHandler } from '@/src/client/opts-handlers/environment-cfg-handler.js';

/**
 * @internal
 */
interface AdminOptsTypes extends OptionsHandlerTypes {
  Parsed: ParsedAdminOptions,
  Parseable: AdminOptions | undefined | null,
}

/**
 * @internal
 */
export type ParsedAdminOptions = MonoidType<typeof monoid> & Parsed<'AdminOptions'>;

/**
 * @internal
 */
const monoid = monoids.object({
  logging: InternalLogger.cfg,
  adminToken: TokenProvider.opts,
  endpointUrl: monoids.optional<string>(),
  additionalHeaders: monoids.record<string>(),
  astraEnv: monoids.optional<'dev' | 'prod' | 'test'>(),
  timeoutDefaults: Timeouts.cfg,
});

/**
 * @internal
 */
const decoder = nullish(exact({
  environment: EnvironmentCfgHandler.decoder,
  logging: InternalLogger.cfg.decoder,
  adminToken: TokenProvider.opts.decoder,
  endpointUrl: optional(string),
  additionalHeaders: optional(record(string)),
  astraEnv: optional(oneOf(<const>['dev', 'prod', 'test'])),
  timeoutDefaults: Timeouts.cfg.decoder,
}));

/**
 * @internal
 */
const transformer = decoder.transform((input) => {
  if (!input) {
    return monoid.empty;
  }

  return {
    ...input,
    endpointUrl: input.endpointUrl,
    additionalHeaders: input.additionalHeaders ?? {},
    astraEnv: input.astraEnv,
  };
});

/**
 * @internal
 */
export const AdminOptsHandler = new MonoidalOptionsHandler<AdminOptsTypes>(transformer, monoid);
