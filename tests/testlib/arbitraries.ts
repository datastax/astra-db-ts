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

import fc from 'fast-check';
import { DataAPIEnvironments } from '@/src/lib/index.js';
import { EnvironmentCfgHandler } from '@/src/client/opts-handlers/environment-cfg-handler.js';
import { AlwaysAvailableBuffer } from '@/tests/testlib/utils.js';

export const arbs = <const>{
  nonAstraEnvs: () => fc.constantFrom(...DataAPIEnvironments.filter(e => e !== 'astra').map((e) => EnvironmentCfgHandler.parse(e))),
  pathSegment: () => fc.oneof(fc.string(), fc.integer()),
  path: () => fc.array(fc.oneof(fc.string(), fc.integer())),
  cursorState: () => fc.constantFrom('idle', 'started', 'closed'),
  record: <T>(arb: fc.Arbitrary<T>) => fc.dictionary(fc.string().filter((s) => s !== '__proto__'), arb, { noNullPrototype: true }),
  validBase46: () => fc.base64String().filter((base64) => base64 === AlwaysAvailableBuffer.from(base64, 'base64').toString('base64')),
};
