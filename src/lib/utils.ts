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

import { WithKeyspace } from '@/src/db';
import { WithNullableKeyspace } from '@/src/db/types/collections-common';
import { DataAPIEnvironment, nullish } from '@/src/lib/types';
import { DataAPIEnvironments } from '@/src/lib/constants';

export function isNullish(t: unknown): t is nullish {
  return t === null || t === undefined;
}

export function validateDataAPIEnv(env: unknown): asserts env is DataAPIEnvironment | nullish {
  if (!isNullish(env) && !DataAPIEnvironments.includes(env as any)) {
    throw new Error(`Given environment is invalid (must be ${DataAPIEnvironments.map(e => `"${e}"`).join(', ')}, or nullish to default to "astra".`);
  }
}

export function jsonTryParse<T>(json: string, otherwise: T, reviver?: (this: any, key: string, value: any) => any): T {
  try {
    return JSON.parse(json, reviver);
  } catch (_) {
    return otherwise;
  }
}

export function resolveKeyspace(obj: WithKeyspace | nullish, nullBypass?: false): string | undefined

export function resolveKeyspace(obj: WithNullableKeyspace | nullish, nullBypass: true): string | nullish

export function resolveKeyspace(obj: WithNullableKeyspace | nullish, nullBypass?: boolean): string | nullish {
  return (nullBypass)
    ? (obj?.keyspace !== undefined) ? obj?.keyspace: (<any>obj)?.namespace
    : obj?.keyspace ?? (<any>obj)?.namespace ?? undefined;
}
