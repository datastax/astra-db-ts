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

import { MonoidalOptionsHandler, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler';
import { DecoderType, object, optional, positiveNumber } from 'decoders';
import { TimeoutDescriptor } from '@/src/lib';

/**
 * @internal
 */
export type ParsedTimeoutDescriptor = Partial<TimeoutDescriptor> & Parsed<'TimeoutDescriptor'>;

/**
 * @internal
 */
interface TimeoutCfgTypes extends OptionsHandlerTypes {
  Parsed: ParsedTimeoutDescriptor,
  Parseable: Partial<TimeoutDescriptor> | undefined,
  Decoded: DecoderType<typeof timeoutDescriptor>,
}

/**
 * @internal
 */
const timeoutDescriptor = optional(object({
  requestTimeoutMs: optional(positiveNumber),
  generalMethodTimeoutMs: optional(positiveNumber),
  collectionAdminTimeoutMs: optional(positiveNumber),
  tableAdminTimeoutMs: optional(positiveNumber),
  databaseAdminTimeoutMs: optional(positiveNumber),
  keyspaceAdminTimeoutMs: optional(positiveNumber),
}));

/**
 * @internal
 */
export const TimeoutCfgHandler = new MonoidalOptionsHandler<TimeoutCfgTypes>({
  decoder: timeoutDescriptor,
  refine(input) {
    return input ?? this.empty;
  },
  concat(configs) {
    return configs.reduce((acc, next) => ({
      requestTimeoutMs: next.requestTimeoutMs ?? acc.requestTimeoutMs,
      generalMethodTimeoutMs: next.generalMethodTimeoutMs ?? acc.generalMethodTimeoutMs,
      collectionAdminTimeoutMs: next.collectionAdminTimeoutMs ?? acc.collectionAdminTimeoutMs,
      tableAdminTimeoutMs: next.tableAdminTimeoutMs ?? acc.tableAdminTimeoutMs,
      databaseAdminTimeoutMs: next.databaseAdminTimeoutMs ?? acc.databaseAdminTimeoutMs,
      keyspaceAdminTimeoutMs: next.keyspaceAdminTimeoutMs ?? acc.keyspaceAdminTimeoutMs,
    }), this.empty);
  },
  empty: {},
});
