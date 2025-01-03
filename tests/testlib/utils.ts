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

import { DEFAULT_KEYSPACE } from '@/src/lib/api';
import {
  DEFAULT_COLLECTION_NAME,
  DEFAULT_TABLE_NAME,
  OTHER_KEYSPACE,
  TEST_APPLICATION_URI,
} from '@/tests/testlib/config';
import { GLOBAL_FIXTURES } from '@/tests/testlib/global';

export async function tryCatchErr(fn: () => void | Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    return e as Error;
  }
}

export async function dropEphemeralColls() {
  const promises: Promise<unknown>[] = [];

  for (const keyspace of [DEFAULT_KEYSPACE, OTHER_KEYSPACE]) {
    const collections = await GLOBAL_FIXTURES.db.listCollections({ keyspace, nameOnly: true });

    collections
      .filter(c => c !== DEFAULT_COLLECTION_NAME)
      .forEach(c => promises.push(GLOBAL_FIXTURES.db.dropCollection(c, { keyspace })));
  }

  await Promise.all(promises);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

export async function dropEphemeralTables() {
  const promises: Promise<unknown>[] = [];

  for (const keyspace of [DEFAULT_KEYSPACE, OTHER_KEYSPACE]) {
    const tables = await GLOBAL_FIXTURES.db.listTables({ keyspace, nameOnly: true });

    tables
      .filter(t => t !== DEFAULT_TABLE_NAME)
      .forEach(t => promises.push(GLOBAL_FIXTURES.db.dropTable(t, { keyspace })));
  }

  await Promise.all(promises);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

export function processTags(tags: string): string[] {
  const matches = tags.match(/\(([A-Z-]+?)\)/g);

  if (!matches) {
    return [];
  }

  return matches.map(tag => tag.slice(1, -1));
}

export function checkTestsEnabled(name: string) {
  const tags = processTags(name);

  tags.forEach((tag) => {
    if (!['VECTORIZE', 'LONG', 'ADMIN', 'DEV', 'ASTRA'].includes(tag.replace(/^NOT-/, ''))) {
      throw new Error(`Unknown test tag, '${tag}'`);
    }
  });

  return ifMatchTag(tags, 'VECTORIZE', () => process.env.CLIENT_RUN_VECTORIZE_TESTS)
      && ifMatchTag(tags, 'LONG',      () => process.env.CLIENT_RUN_LONG_TESTS)
      && ifMatchTag(tags, 'ADMIN',     () => process.env.CLIENT_RUN_ADMIN_TESTS)
      && ifMatchTag(tags, 'DEV',       () => TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com'))
      && ifMatchTag(tags, 'ASTRA',     () => TEST_APPLICATION_URI.includes('datastax.com'));
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
