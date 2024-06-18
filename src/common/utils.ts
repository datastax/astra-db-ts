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

import { DataAPIEnvironment, nullish } from '@/src/common/types';
import { DataAPIEnvironments } from '@/src/common/constants';

export function isNullish(t: unknown): t is nullish {
  return t === null || t === undefined;
}

export function validateDataAPIEnv(env: unknown): asserts env is DataAPIEnvironment | nullish {
  if (!isNullish(env) && !DataAPIEnvironments.includes(env as any)) {
    throw new Error(`Given environment is invalid (must be ${DataAPIEnvironments.map(e => `"${e}"`).join(', ')}, or nullish to default to "astra".`);
  }
}
