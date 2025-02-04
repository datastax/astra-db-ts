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

import { oneOrMany } from '@/src/lib/utils';
import { either, nullish, string, tuple } from 'decoders';
import { OptionsHandler, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler';
import { Caller } from '@/src/client';
import { OneOrMany } from '@/src/lib';
import { CLIENT_USER_AGENT } from '@/src/lib/api/constants';

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: ParsedCaller,
  Parseable: OneOrMany<Caller> | undefined | null,
}

/**
 * @internal
 */
export interface ParsedCaller extends Parsed<'Caller'> {
  userAgent: string,
}

/**
 * @internal
 */
const decoder = nullish(oneOrMany(either(
  tuple(string),
  tuple(string, string),
)), []);

const transformer = decoder.transform((config) => {
  const callers = (
    (Array.isArray(config[0]))
      ?  config
      : [config]
  );

  const callerString = callers.map((c) => {
    return (c[1]) ? `${c[0]}/${c[1]}` : c[0];
  }).join(' ');

  return {
    userAgent: `${CLIENT_USER_AGENT} ${callerString}`.trim(),
  };
});

/**
 * @internal
 */
export const CallerCfgHandler = new OptionsHandler<Types>(transformer);
