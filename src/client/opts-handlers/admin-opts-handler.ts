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

import { DecoderType, OptionsHandler, OptionsHandlerOpts } from '@/src/lib/opts-handler';
import { AdminOptions } from '@/src/client';
import { TimeoutDescriptor, TokenProvider } from '@/src/lib';
import { nullish, number, object, oneOf, optional, record, string } from 'decoders';
import { Timeouts } from '@/src/lib/api/timeouts';
import { Logger } from '@/src/lib/logging/logger';

export interface InternalAdminOptions {
  logging: typeof Logger.cfg.transformed,
  adminToken: typeof TokenProvider.opts.transformed,
  endpointUrl: string | undefined,
  additionalHeaders: Record<string, string>,
  astraEnv: 'dev' | 'prod' | 'test' | undefined,
  timeoutDefaults: Partial<TimeoutDescriptor>,
}

interface AdminOptsTypes extends OptionsHandlerOpts {
  Transformed: InternalAdminOptions,
  Parseable: AdminOptions | null | undefined,
  Parsed: DecoderType<typeof adminOpts>,
}

const adminOpts = nullish(object({
  logging: Logger.cfg.decoder,
  adminToken: TokenProvider.opts.decoder,
  endpointUrl: optional(string),
  additionalHeaders: optional(record(string)),
  astraEnv: optional(oneOf(<const>['dev', 'prod', 'test'])),
  timeoutDefaults: optional(record(number)),
}));

export const AdminOptsHandler = new OptionsHandler<AdminOptsTypes>({
  decoder: adminOpts,
  transform(input, field) {
    return {
      logging: Logger.cfg.parseWithin(input, `${field}.logging`),
      adminToken: TokenProvider.opts.parseWithin(input, `${field}.adminToken`),
      endpointUrl: input?.endpointUrl ?? undefined,
      additionalHeaders: input?.additionalHeaders ?? {},
      astraEnv: input?.astraEnv ?? undefined,
      timeoutDefaults: Timeouts.merge(Timeouts.Default, input?.timeoutDefaults),
    };
  },
  concat(configs): InternalAdminOptions {
    return configs.reduce((acc, next) => ({
      logging: Logger.cfg.concat(acc.logging, next.logging),
      adminToken: TokenProvider.opts.concat(acc.adminToken, next.adminToken),
      endpointUrl: next.endpointUrl ?? acc.endpointUrl,
      additionalHeaders: { ...acc.additionalHeaders, ...next.additionalHeaders },
      astraEnv: next.astraEnv ?? acc.astraEnv,
      timeoutDefaults: Timeouts.merge(acc.timeoutDefaults, next.timeoutDefaults),
    }), AdminOptsHandler.empty);
  },
  empty: {
    logging: Logger.cfg.empty,
    adminToken: TokenProvider.opts.empty,
    endpointUrl: undefined,
    additionalHeaders: {},
    astraEnv: undefined,
    timeoutDefaults: Timeouts.Default,
  },
});
