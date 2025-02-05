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

import { nullish, oneOf } from 'decoders';
import type { OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler.js';
import { OptionsHandler } from '@/src/lib/opts-handler.js';
import { type DataAPIEnvironment, DataAPIEnvironments } from '@/src/lib/index.js';

/**
 * @internal
 */
export type ParsedEnvironment = (DataAPIEnvironment | (string & Record<never, never>)) & Parsed<'DataAPIEnvironment'>;

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parseable: DataAPIEnvironment | undefined | null,
  Parsed: ParsedEnvironment,
}

/**
 * @internal
 */
export const EnvironmentCfgHandler = new OptionsHandler<Types>(
  nullish(oneOf(DataAPIEnvironments), 'astra'),
);
