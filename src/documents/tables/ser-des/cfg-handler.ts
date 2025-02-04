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

import { boolean, exact, nullish, optional } from 'decoders';
import type {
  ParsedSerDesConfig} from '@/src/lib/api/ser-des/cfg-handler';
import {
  serDesDecoders,
  serdesMonoidSchema,
  serDesTransform,
} from '@/src/lib/api/ser-des/cfg-handler';
import type { OptionsHandlerTypes } from '@/src/lib/opts-handler';
import { MonoidalOptionsHandler, monoids } from '@/src/lib/opts-handler';
import type { TableSerDesConfig } from '@/src/documents';

/**
 * @internal
 */
interface SerDesConfigTypes extends OptionsHandlerTypes {
  Parsed: ParsedSerDesConfig<TableSerDesConfig>,
  Parseable: TableSerDesConfig | null | undefined,
}

/**
 * @internal
 */
const monoid = monoids.object({
  ...serdesMonoidSchema,
  sparseData: monoids.optional<boolean>(),
});

/**
 * @internal
 */
const decoder = nullish(exact({
  ...serDesDecoders,
  sparseData: optional(boolean),
}));

/**
 * @internal
 */
const transformer = decoder.transform((input) => (input)
  ? { ...serDesTransform(input), sparseData: input.sparseData }
  : monoid.empty);

/**
 * @internal
 */
export const TableSerDesCfgHandler = new MonoidalOptionsHandler<SerDesConfigTypes>(transformer, monoid);
