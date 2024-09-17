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

import { DEFAULT_NAMESPACE } from '@/src/api';
import { DEFAULT_COLLECTION_NAME, OTHER_NAMESPACE, TEST_APPLICATION_URI } from '@/tests/testlib/config';
import { Collection } from '@/src/data-api';
import { GLOBAL_FIXTURES } from '@/tests/testlib/global';

export async function tryCatchErr(fn: () => void | Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    return e as Error;
  }
}

export async function dropEphemeralColls() {
  const promises: Promise<boolean>[] = [];

  for (const namespace of [DEFAULT_NAMESPACE, OTHER_NAMESPACE]) {
    const collections = await GLOBAL_FIXTURES.db.listCollections({ namespace });

    collections
      .filter(c => c.name !== DEFAULT_COLLECTION_NAME)
      .forEach(c => promises.push(GLOBAL_FIXTURES.db.dropCollection(c.name, { namespace })));
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
    if (!['VECTORIZE', 'LONG', 'ADMIN', 'DEV', 'NOT-DEV', 'ASTRA'].includes(tag)) {
      throw new Error(`Unknown test tag, '${tag}'`);
    }
  });

  if (tags.includes('VECTORIZE') && !process.env.CLIENT_RUN_VECTORIZE_TESTS) {
    return false;
  }

  if (tags.includes('LONG') && !process.env.CLIENT_RUN_LONG_TESTS) {
    return false;
  }

  if (tags.includes('ADMIN') && !process.env.CLIENT_RUN_ADMIN_TESTS) {
    return false;
  }

  if (tags.includes('DEV') && !TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    return false;
  }

  if (tags.includes('NOT-DEV') && TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    return false;
  }

  return !(tags.includes('ASTRA') && !TEST_APPLICATION_URI.includes('datastax.com'));
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

export function createCollections<Keys extends string>(colls: () => Record<Keys, Promise<Collection>>): Record<Keys, Collection> {
  const collections: Record<string, Collection> = {};

  before(async () => {
    const promises = Object.entries(colls()).map(([name, promise]) => (<Promise<Collection>>promise).then(coll => <const>[name, coll]));

    const entries = await Promise.all(promises);

    for (const [name, coll] of entries) {
      collections[name] = coll;
    }
  });

  return collections;
}

export function negate<T extends any[]>(fn: (...args: T) => boolean): (...args: T) => boolean {
  return (...args: T) => !fn(...args);
}
