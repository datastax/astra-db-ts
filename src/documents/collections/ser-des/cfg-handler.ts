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

import { either, exact, nullish, oneOf, optional, record } from 'decoders';
import type {
  ParsedSerDesConfig} from '@/src/lib/api/ser-des/cfg-handler.js';
import {
  serDesDecoders,
  serdesMonoidSchema,
  serDesTransform,
} from '@/src/lib/api/ser-des/cfg-handler.js';
import type { OptionsHandlerTypes } from '@/src/lib/opts-handler.js';
import { MonoidalOptionsHandler, monoids } from '@/src/lib/opts-handler.js';
import type { CollNumRepCfg, CollSerDesConfig, GetCollNumRepFn } from '@/src/documents/index.js';
import { function_ } from '@/src/lib/utils.js';

const CollNumReps = ['number', 'bigint', 'bignumber', 'string', 'number_or_string'] as const;

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: ParsedSerDesConfig<CollSerDesConfig>,
  Parseable: CollSerDesConfig | null | undefined,
}

/**
 * @internal
 */
const monoid = monoids.object({
  ...serdesMonoidSchema,
  enableBigNumbers: monoids.optional<CollNumRepCfg | GetCollNumRepFn>(),
});

/**
 * @internal
 */
const decoder = nullish(exact({
  ...serDesDecoders,
  enableBigNumbers: optional(either(function_, record(oneOf(CollNumReps)))),
}));

/**
 * @internal
 */
const transformer = decoder.transform((input) => (input)
  ? { ...serDesTransform(input), enableBigNumbers: input.enableBigNumbers }
  : monoid.empty);

/**
 * @internal
 */
export const CollSerDesCfgHandler = new MonoidalOptionsHandler<Types>(transformer, monoid);
