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
import { TokenProvider } from '@/src/lib';
import { Logger } from '@/src/lib/logging/logger';
import { AdminOptions } from '@/src/client';
import { Timeouts } from '@/src/lib/api/timeouts';

/**
 * @internal
 */
export const parseAdminSpawnOpts: Parser<AdminOptions | undefined, unknown> = (raw, field) => {
  const opts = p.parse('object?')<AdminOptions>(raw, field);

  if (!opts) {
    return undefined;
  }

  return {
    logging: Logger.parseConfig(opts.logging, `${field}.logging`),
    endpointUrl: p.parse('string?')(opts.endpointUrl, `${field}.endpointUrl`),
    adminToken: TokenProvider.mergeTokens(opts.adminToken),
    additionalHeaders: p.parse('object?')(opts.additionalHeaders, `${field}.additionalHeaders`),
    astraEnv: p.parse('string?')(opts.astraEnv, `${field}.astraEnv`),
    timeoutDefaults: Timeouts.parseConfig(opts.timeoutDefaults, `${field}.timeoutDefaults`),
  };
};
