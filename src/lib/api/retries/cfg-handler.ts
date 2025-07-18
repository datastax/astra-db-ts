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
import { either, exact, nullish, optional } from 'decoders';
import type { RetryConfig, ExplicitRetryConfig } from '@/src/lib/api/retries/config.js';
import { RetryPolicy } from '@/src/lib/api/retries/policy.js';
import type { RetryContext } from '@/src/lib/api/retries/contexts/base.js';
import type { DataAPIRetryContext } from '@/src/lib/api/retries/contexts/data-api.js';
import type { DevOpsAPIRetryContext } from '@/src/lib/api/retries/contexts/devops-api.js';
import { anyInstanceOf } from '@/src/lib/utils.js';

/**
 * @internal
 */
interface Type extends OptionsHandlerTypes {
  Parsed: ParsedRetryConfig,
  Parseable: RetryConfig | undefined | null,
}

/**
 * @internal
 */
export type ParsedRetryConfig = ExplicitRetryConfig & Parsed<'RetryConfig'>;

const monoid = monoids.object({
  defaultPolicy: monoids.optional<RetryPolicy<RetryContext>>(),
  dataAPIPolicy: monoids.optional<RetryPolicy<DataAPIRetryContext>>(),
  devOpsAPIPolicy: monoids.optional<RetryPolicy<DevOpsAPIRetryContext>>(),
});

/**
 * @internal
 */
const decoder = nullish(either(
  anyInstanceOf(RetryPolicy),
  exact({
    defaultPolicy: optional(anyInstanceOf(RetryPolicy)),
    dataAPIPolicy: optional(anyInstanceOf(RetryPolicy)),
    devOpsAPIPolicy: optional(anyInstanceOf(RetryPolicy)),
  }),
), {});

/**
 * @internal
 */
const transformer = decoder.transform((config) => {
  if (!config) {
    return monoid.empty;
  }

  if (config instanceof RetryPolicy) {
    return { defaultPolicy: config };
  }

  return config;
});

/**
 * @internal
 */
export const RetryCfgHandler = new MonoidalOptionsHandler<Type>(transformer, monoid);
