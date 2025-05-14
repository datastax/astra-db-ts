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

import { DEFAULT_KEYSPACE } from '@/src/lib/api/index.js';
import type { FetcherResponseInfo } from '@/src/index.js';
import { Cfg } from '@/tests/testlib/config.js';
import { GLOBAL_FIXTURES } from '@/tests/testlib/global.js';
import type { SomeDoc } from '@/src/documents/index.js';
import assert from 'assert';
import type { HTTPRequestInfo } from '@/src/lib/api/clients/index.js';
import stableStringify from 'safe-stable-stringify';

export const AlwaysAvailableBuffer = Buffer; // some tests temporarily delete the global Buffer object

export async function tryCatchErrAsync(fn: () => Promise<void> | void) {
  try {
    await fn();
  } catch (e: any) {
    return e as Error;
  }
}

export function tryCatchErrSync(fn: () => void) {
  try {
    fn();
  } catch (e: any) {
    return e as Error;
  }
}

export async function dropEphemeralColls() {
  const promises: Promise<unknown>[] = [];

  for (const keyspace of [DEFAULT_KEYSPACE, Cfg.OtherKeyspace]) {
    const collections = await GLOBAL_FIXTURES.db.listCollections({ keyspace, nameOnly: true });

    collections
      .filter(c => c !== Cfg.DefaultCollectionName)
      .forEach(c => promises.push(GLOBAL_FIXTURES.db.dropCollection(c, { keyspace })));
  }

  await Promise.all(promises);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

export async function dropEphemeralTables() {
  const promises: Promise<unknown>[] = [];

  for (const keyspace of [DEFAULT_KEYSPACE, Cfg.OtherKeyspace]) {
    const tables = await GLOBAL_FIXTURES.db.listTables({ keyspace, nameOnly: true });

    tables
      .filter(t => t !== Cfg.DefaultTableName)
      .forEach(t => promises.push(GLOBAL_FIXTURES.db.dropTable(t, { keyspace })));
  }

  await Promise.all(promises);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

export function checkTestsEnabled(name: string) {
  const tags = processTags(name);

  tags.forEach((tag) => {
    if (!['VECTORIZE', 'LONG', 'ADMIN', 'DEV', 'ASTRA', 'RERANKING'].includes(tag.replace(/^NOT-/, ''))) {
      throw new Error(`Unknown test tag, '${tag}'`);
    }
  });

  return ifMatchTag(tags, 'VECTORIZE', () => Cfg.RunTests.Vectorize)
      && ifMatchTag(tags, 'LONG',      () => Cfg.RunTests.LongRunning)
      && ifMatchTag(tags, 'ADMIN',     () => Cfg.RunTests.Admin)
      && ifMatchTag(tags, 'DEV',       () => Cfg.DbUrl.includes('apps.astra-dev.datastax.com'))
      && ifMatchTag(tags, 'ASTRA',     () => Cfg.DbUrl.includes('datastax.com'))
      && ifMatchTag(tags, 'RERANKING', () => true);
}

function processTags(tags: string): string[] {
  const matches = tags.match(/\(([A-Z-]+?)\)/g);

  if (!matches) {
    return [];
  }

  return matches.map(tag => tag.slice(1, -1));
}

function ifMatchTag(tags: string[], expected: string, pred: () => unknown) {
  const tag = tags.find((tag) => expected === tag || `NOT-${expected}` === tag);

  return (tag)
    ? tag.startsWith('NOT-') !== !!pred()
    : true;
}

declare global {
  interface Array<T> {
    tap(consumer: (t: T) => void): T[];
    awaitAll(): Promise<(T extends Promise<infer P> ? P : T)[]>;
  }
}

Array.prototype.tap = function <T>(consumer: (t: T) => void) {
  this.forEach(consumer);
  return this;
};

Array.prototype.awaitAll = function () {
  return Promise.all(this);
};

export function useSuiteResources<Keys extends string, T>(mkResources: () => Record<Keys, Promise<T>>): Record<Keys, T> {
  const resources: Record<string, T> = {};

  before(async () => {
    const promises = Object.entries(mkResources()).map(([name, promise]) => (<Promise<T>>promise).then(resource => <const>[name, resource]));

    const entries = await Promise.all(promises);

    for (const [name, coll] of entries) {
      resources[name] = coll;
    }
  });

  return resources;
}

export function negate<T extends any[]>(fn: (...args: T) => boolean): (...args: T) => boolean {
  return (...args: T) => !fn(...args);
}

export function memoizeRequests<H extends { _httpClient: any }>(hasHttpClient: H): H {
  const requestCache: Record<string, FetcherResponseInfo> = {};
  const requestFn = hasHttpClient._httpClient._request;

  hasHttpClient._httpClient._request = async (info: HTTPRequestInfo): Promise<FetcherResponseInfo> => {
    const key = stableStringify([
      info.url,
      info.data,
      info.params,
      info.method,
    ]);

    if (key in requestCache) {
      return requestCache[key];
    }

    return requestCache[key] = requestFn.call(hasHttpClient._httpClient, info);
  };

  return hasHttpClient;
}

const withMaybePromise = <T>(value: T, cb: (value: T) => void): T => {
  if (value instanceof Promise) {
    return value.then(cb).then(() => value) as T;
  } else {
    cb(value);
    return value;
  }
};

export class DeltaAsserter<Fields extends string> {
  constructor(private readonly _fields: Fields[], private readonly _extend?: DeltaAsserter<Fields>) {}

  public captureMutDelta<R>(obj: SomeDoc, cb: () => R) {
    const snapshot = this._buildSnapshot(obj);
    const ret = cb();

    return {
      assertDelta: (delta: Partial<Record<Fields, unknown>>): R => {
        this._assertDelta(snapshot, obj, delta);
        return ret;
      },
    };
  }

  public captureImmutDelta<R extends SomeDoc>(obj: SomeDoc, cb: () => R) {
    const snapshot = this._buildSnapshot(obj);
    const newObj = cb();

    return {
      assertDelta: (delta: Partial<Record<Fields, unknown>>): R => {
        this._assertDelta(snapshot, obj, {});
        this._assertDelta(snapshot, newObj, delta);
        return newObj;
      },
    };
  }

  public assertMutDelta<R>(obj: SomeDoc, cb: () => R): R {
    const snapshot = this._buildSnapshot(obj);

    return withMaybePromise(cb(), () => {
      assert.notDeepStrictEqual(this._buildSnapshot(obj), snapshot);
    });
  }

  public assertNoMutDelta<R>(obj: SomeDoc, cb: () => R): R {
    const snapshot = this._buildSnapshot(obj);

    return withMaybePromise(cb(), () => {
      assert.deepStrictEqual(this._buildSnapshot(obj), snapshot);
    });
  }

  private _buildSnapshot(obj: Record<string, unknown>, base?: Record<string, string | undefined>): Record<string, string | undefined> {
    const snapshot = base ?? {};

    for (const field of this._fields) {
      snapshot[field] = stableStringify(obj[field]);
    }

    if (this._extend) {
      return this._extend._buildSnapshot(obj, snapshot);
    }

    return snapshot;
  }

  private _assertDelta(snapshot: Record<string, string | undefined>, current: Record<string, unknown>, expectedDelta: Record<string, unknown>) {
    for (const field of this._fields) {
      if (field in expectedDelta) {
        assert.deepStrictEqual(stableStringify(current[field]), stableStringify(expectedDelta[field]));
      } else {
        assert.deepStrictEqual(stableStringify(current[field]), snapshot[field]);
      }
    }

    if (this._extend) {
      this._extend._assertDelta(snapshot, current, expectedDelta);
    }
  }
}

export const untouchable = <T extends object>(target: T = {} as T) => new Proxy(target, {
  get() {
    throw new Error('Untouchable proxy used');
  },
});

export function traverseObject(obj: SomeDoc, visitor: (obj: SomeDoc, key: string | number) => void) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      visitor(obj, i);
      traverseObject(obj[i], visitor);
    }
  } else if (typeof obj === 'object') {
    for (const key in obj) {
      visitor(obj, key);
      traverseObject(obj[key], visitor);
    }
  }
}

export const desSchema = (schema: Record<string, unknown> = {}) => {
  return { status: { projectionSchema: schema, primaryKeySchema: schema } };
};

export const assertPromiseResolvesInTicks = async <T>(ticks: number, mk: () => Promise<T>): Promise<T> => {
  const promise = mk();

  let resolvedTicks = -1;
  let currentTick = 0;

  void promise.then(() => {
    resolvedTicks = currentTick;
  });

  while (resolvedTicks === -1) {
    await Promise.resolve();
    currentTick++;
  }

  assert.strictEqual(resolvedTicks, ticks, `Promise resolved in ${resolvedTicks} ticks, expected ${ticks} ticks`);
  return promise;
};
