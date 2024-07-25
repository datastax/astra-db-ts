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

import {
  DEFAULT_COLLECTION_NAME,
  EPHEMERAL_COLLECTION_NAME,
  initTestObjects,
  OTHER_NAMESPACE,
  TEST_APPLICATION_URI,
} from '@/tests/fixtures';
import { Context } from 'mocha';
import { Collection, CreateCollectionOptions, Db, SomeDoc } from '@/src/data-api';
import { Ref } from '@/src/common';

export function createManagedCollection(db: Db, name: string, opts: CreateCollectionOptions<SomeDoc>) {
  const collection: Ref<Collection> = { ref: null! };

  before(async () => {
    collection.ref = await db.createCollection(name, { checkExists: false, ...opts });
  });

  beforeEach(async () => {
    await collection.ref.deleteMany({});
  });

  after(async () => {
    await db.dropCollection(name);
  });

  return collection;
}

type TestFn = Mocha.Func | Mocha.AsyncFunc;

interface TaggableTestFunction {
  (name: string, fn: Mocha.Func): Mocha.Test;
  (name: string, fn: Mocha.AsyncFunc): Mocha.Test;
}

export let it: TaggableTestFunction;

it = function (name: string, fn: TestFn) {
  const tags = processTags(name);

  function modifiedFn(this: Mocha.Context) {
    assertTestsEnabled.call(this, tags);
    return fn.call(this, null!);
  }

  return global.it(name, modifiedFn);
}

type SuiteFn = (this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) => void;

interface SuiteOptions {
  truncateColls?: 'default' | 'both',
  dropEphemeral?: boolean,
}

interface TaggableSuiteFunction {
  (name: string, fn: SuiteFn): Mocha.Suite;
  (name: string, options: SuiteOptions, fn: SuiteFn): Mocha.Suite;
}

export let describe: TaggableSuiteFunction;

describe = function (name: string, optsOrFn: SuiteOptions | SuiteFn, maybeFn?: SuiteFn) {
  const fn = (!maybeFn)
    ? optsOrFn as SuiteFn
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
        if (opts.dropEphemeral) {
          await fixtures.db.dropCollection(EPHEMERAL_COLLECTION_NAME);
          await fixtures.db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
        }

        if (opts.truncateColls) {
          await fixtures.collection.deleteMany({});
        }

        if (opts.truncateColls === 'both') {
          await fixtures.db.collection(DEFAULT_COLLECTION_NAME, { namespace: OTHER_NAMESPACE }).deleteMany();
        }
      });
    }

    return fn.call(this, fixtures);
  }

  return global.describe(name, modifiedFn);
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
