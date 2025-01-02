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

import { DataAPIEnvironment, nullish } from '@/src/lib/types';
import { DataAPIEnvironments } from '@/src/lib/constants';
import JBI from 'json-bigint';
import { SomeDoc } from '@/src/documents';
import process from 'node:process';
import BigNumber from 'bignumber.js';

/**
 * @internal
 */
export function isNullish(t: unknown): t is nullish {
  return t === null || t === undefined;
}

/**
 * @internal
 */
export function validateDataAPIEnv(env: unknown): asserts env is DataAPIEnvironment | nullish {
  if (!isNullish(env) && !(<readonly unknown[]>DataAPIEnvironments).includes(env)) {
    throw new Error(`Given environment is invalid (must be ${DataAPIEnvironments.map(e => `"${e}"`).join(', ')}, or nullish to default to "astra".`);
  }
}

/**
 * @internal
 */
export function jsonTryParse<T>(json: string, otherwise: T, reviver?: (this: unknown, key: string, value: unknown) => unknown): T {
  try {
    return JSON.parse(json, reviver);
  } catch (_) {
    return otherwise;
  }
}

/**
 * @internal
 */
export function buildAstraEndpoint(id: string, region: string, env: 'dev' | 'test' | 'prod' = 'prod') {
  return 'https://' + id + '-' + region + `.apps${env === 'prod' ? '' : `-${env}`}.astra.datastax.com`;
}

/**
 * @internal
 */
export function toArray<T>(t: T | readonly T[]): readonly T[] {
  return Array.isArray(t) ? t : [t] as readonly [T];
}

/**
 * @internal
 */
export function withJbiNullProtoFix(jbi: { parse: typeof JBI['parse']; stringify: typeof JBI['stringify'] }) {
  return {
    parse: (str: string) => nullProtoFix(jbi.parse(str)),
    stringify: jbi.stringify,
  };
}

function nullProtoFix(doc: SomeDoc): SomeDoc {
  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      if (typeof doc[i] === 'object' && doc[i] !== null) {
        doc[i] = nullProtoFix(doc[i]);
      }
    }
  } else {
    doc = Object.assign({}, doc);

    for (const key of Object.keys(doc)) {
      if (typeof doc[key] === 'object' && doc[key] !== null) {
        doc[key] = nullProtoFix(doc[key]);
      }
    }
  }

  return doc;
}

export function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

interface JSEnvs<T> {
  server: T,
  browser: T,
  unknown: T,
}

const getJSEnv = () =>
  (typeof globalThis.window !== 'undefined')
    ? 'browser' :
  (typeof globalThis.Buffer !== 'undefined')
    ? 'server'
    : 'unknown';

const env = getJSEnv();

export function forJSEnv<F extends (...args: any[]) => any>(fns: JSEnvs<F>) {
  if (process.env.CLIENT_DYNAMIC_JS_ENV_CHECK) {
    return (...args: Parameters<F>) => {
      return fns[getJSEnv()](...args);
    };
  }
  return fns[env];
}

export function isBigNumber(value: object): value is BigNumber {
  return BigNumber.isBigNumber(value) && value.constructor?.name === 'BigNumber';
}
