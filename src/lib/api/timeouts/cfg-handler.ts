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

import type { OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handlers.js';
import { MonoidalOptionsHandler, monoids } from '@/src/lib/opts-handlers.js';
import { exact, nullish, optional, positiveNumber } from 'decoders';
import type { TimeoutDescriptor } from '@/src/lib/index.js';

/**
 * @internal
 */
interface Type extends OptionsHandlerTypes {
  Parsed: ParsedTimeoutDescriptor,
  Parseable: Partial<TimeoutDescriptor> | undefined | null,
}

/**
 * @internal
 */
export type ParsedTimeoutDescriptor = Partial<TimeoutDescriptor> & Parsed<'TimeoutDescriptor'>;

const monoid = monoids.object({
  requestTimeoutMs: monoids.optional<number>(),
  generalMethodTimeoutMs: monoids.optional<number>(),
  collectionAdminTimeoutMs: monoids.optional<number>(),
  tableAdminTimeoutMs: monoids.optional<number>(),
  databaseAdminTimeoutMs: monoids.optional<number>(),
  keyspaceAdminTimeoutMs: monoids.optional<number>(),
});

/**
 * @internal
 */
const decoder = nullish(exact({
  requestTimeoutMs: optional(positiveNumber),
  generalMethodTimeoutMs: optional(positiveNumber),
  collectionAdminTimeoutMs: optional(positiveNumber),
  tableAdminTimeoutMs: optional(positiveNumber),
  databaseAdminTimeoutMs: optional(positiveNumber),
  keyspaceAdminTimeoutMs: optional(positiveNumber),
}), {});

/**
 * @internal
 */
export const TimeoutCfgHandler = new MonoidalOptionsHandler<Type>(decoder, monoid);
