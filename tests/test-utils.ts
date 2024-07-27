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
/* eslint-disable prefer-const */

import { initTestObjects } from '@/tests/fixtures';
import { afterEach, Context } from 'mocha';
import {
  DEFAULT_COLLECTION_NAME,
  OTHER_NAMESPACE,
  TEST_APPLICATION_URI,
} from '@/tests/config';
import { DEFAULT_NAMESPACE } from '@/src/api';
import { Collection } from '@/src/data-api';

const TESTS_FILTER = (process.env.MOCHA_TESTS_FILTER)
  ? RegExp(process.env.MOCHA_TESTS_FILTER)
  : /.*/;

const GLOBAL_FIXTURES = initTestObjects();

let inParallelBlock: boolean = false;
let globalTests: ParallelTestSpec [] = [];

interface ParallelTestSpec {
  name: string,
  fn: ParallelTest,
}

type ParallelBlock = (this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) => void;
type ParallelTest = () => Promise<void>;

interface ParallelizedTestsBlock {
  (name: string, fn: ParallelBlock): void;
  (name: string, options: SuiteOptions, fn: ParallelBlock): void;
}

export let parallel: ParallelizedTestsBlock;

parallel = function (name: string, optsOrFn: SuiteOptions | ParallelBlock, maybeFn?: ParallelBlock) {
  name = `(parallel) ${name}`

  const fn = (!maybeFn)
    ? optsOrFn as ParallelBlock
    : maybeFn;

  const opts = (maybeFn)
    ? optsOrFn as SuiteOptions
    : {};

  function modifiedFn(this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) {
    if (inParallelBlock) {
      throw new Error('Can\'t nest parallel blocks');
    }

    const [oldBeforeEach, oldAfterEach] = [beforeEach, afterEach];

    global.beforeEach = () => { throw new Error('Can\'t use `beforeEach` in a parallel block'); }
    global.afterEach = () => { throw new Error('Can\'t use `afterEach` in a parallel block'); }

    inParallelBlock = true;
    fn.call(this, fixtures);
    inParallelBlock = false;

    [global.beforeEach, global.afterEach] = [oldBeforeEach, oldAfterEach];

    let tests = globalTests;
    let results: { ms: number, error?: Error }[];

    before(async () => {
      const promises = tests.map(async (test) => {
        const startTime = performance.now();

        return {
          error: await tryCatchErr(test.fn),
          ms: performance.now() - startTime,
        };
      });

      results = await Promise.all(promises);
    });

    tests.forEach((t, i) => {
      it(t.name, function () {
        this.test!.title = `${t.name} (${~~results[i].ms}ms)`;

        if (results[i].error) {
          throw results[i].error;
        }
      });
    });

    globalTests = [];
  }

  return describe(name, opts, modifiedFn);
}

type TestFn = Mocha.Func | Mocha.AsyncFunc;

interface TaggableTestFunction {
  (name: string, fn: Mocha.Func): Mocha.Test;
  (name: string, fn: Mocha.AsyncFunc): Mocha.Test;
}

export let it: TaggableTestFunction;

const parallelItErrorProxy = new Proxy({}, {
  get() { throw new Error('Can not use return type of `it` when in a parallel block') }
});

it = function (name: string, fn: TestFn) {
  const tags = processTags(name);

  function modifiedFn(this: Mocha.Context) {
    assertTestsEnabled.call(this, tags);
    return fn.call(this, null!);
  }

  if (inParallelBlock) {
    globalTests.push({ name, fn: <any>modifiedFn });
    return parallelItErrorProxy as any;
  }

  return global.it(name, modifiedFn);
}

type SuiteBlock = (this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) => void;

interface SuiteOptions {
  truncateColls?: 'default' | 'both',
  dropEphemeral?: 'after' | 'afterEach',
}

interface TaggableSuiteFunction {
  (name: string, fn: SuiteBlock): Mocha.Suite;
  (name: string, options: SuiteOptions, fn: SuiteBlock): Mocha.Suite;
}

export let describe: TaggableSuiteFunction;

describe = function (name: string, optsOrFn: SuiteOptions | SuiteBlock, maybeFn?: SuiteBlock) {
  if (inParallelBlock) {
    throw new Error('Can\'t use `describe` in parallel blocks');
  }

  const fn = (!maybeFn)
    ? optsOrFn as SuiteBlock
    : maybeFn;

  const opts = (maybeFn)
    ? optsOrFn as SuiteOptions
    : {};

  const fixtures = initTestObjects();
  const tags = processTags(name);

  function modifiedFn(this: Mocha.Suite) {
    before(function () {
      assertTestsEnabled.call(this, tags);
    });

    if (opts.dropEphemeral || opts.truncateColls) {
      beforeEach(async () => {
        if (opts.truncateColls) {
          await fixtures.collection.deleteMany({});
        }

        if (opts.truncateColls === 'both') {
          await fixtures.db.collection(DEFAULT_COLLECTION_NAME, { namespace: OTHER_NAMESPACE }).deleteMany();
        }
      });

      if (opts.dropEphemeral === 'after') {
        after(dropEphemeralColls);
      }

      if (opts.dropEphemeral === 'afterEach') {
        afterEach(dropEphemeralColls);
      }
    }

    return fn.call(this, fixtures);
  }

  return global.describe(name, modifiedFn);
}

export const globalBackgroundTests: BackgroundTestSpec[] = [];

interface BackgroundTestSpec {
  name: string,
  res: Promise<{
    error?: Error,
    ms: number,
  }>
}

type BackgroundTest = (fixtures: ReturnType<typeof initTestObjects>) => Promise<void>;

interface BackgroundTestsBlock {
  (name: string, fn: BackgroundTest): void;
  (name: string, fn: BackgroundTest): void;
}

export let background: BackgroundTestsBlock;

background = function (name: string, test: BackgroundTest) {
  if (!TESTS_FILTER.test(name)) {
    return;
  }

  async function modifiedFn() {
    const startTime = performance.now();

    return {
      error: await tryCatchErr(() => test(initTestObjects())),
      ms: performance.now() - startTime,
    };
  }

  globalBackgroundTests.push({
    name: name,
    res: modifiedFn(),
  });
}

async function tryCatchErr(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    return e as Error;
  }
}

async function dropEphemeralColls() {
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

function processTags(tags: string): string[] {
  const matches = tags.match(/\[(.*?)]/g);

  if (!matches) {
    return [];
  }

  return matches.map(tag => tag.slice(1, -1));
}

function assertTestsEnabled(this: Context, tags: string[]) {
  tags.forEach((tag) => {
    if (!['VECTORIZE', 'LONG', 'ADMIN', 'DEV', 'NOT-DEV', 'ASTRA'].includes(tag)) {
      throw new Error(`Unknown test tag, '${tag}'`)
    }
  });

  if (tags.includes('VECTORIZE') && !process.env.ASTRA_RUN_VECTORIZE_TESTS) {
    this.skip();
  }

  if (tags.includes('LONG') && !process.env.ASTRA_RUN_LONG_TESTS) {
    this.skip();
  }

  if (tags.includes('ADMIN') && !process.env.ASTRA_RUN_ADMIN_TESTS) {
    this.skip();
  }

  if (tags.includes('DEV') && !TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    this.skip();
  }

  if (tags.includes('NOT-DEV') && TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    this.skip();
  }

  if (tags.includes('ASTRA') && !TEST_APPLICATION_URI.includes('datastax.com')) {
    this.skip();
  }
}

declare global {
  interface Array<T> {
    tap(consumer: (t: T) => void): Array<T>;
  }
}

Array.prototype.tap = function <T>(consumer: (t: T) => void) {
  this.forEach(consumer);
  return this;
}

export function createCollections<Keys extends string>(colls: () => Record<Keys, Promise<Collection>>): Record<Keys, Collection> {
  const collections: Record<string, Collection> = {}

  before(async () => {
    const promises = Object.entries(colls()).map(([name, promise]) => (<Promise<Collection>>promise).then(coll => <const>[name, coll]));

    const entries = await Promise.all(promises);

    for (const [name, coll] of entries) {
      collections[name] = coll;
    }
  });

  return collections;
}
