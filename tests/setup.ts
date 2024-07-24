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

import dotenv from 'dotenv';
import { Context } from 'mocha';
import { initTestObjects, TEST_APPLICATION_URI } from '@/tests/fixtures';

dotenv.config();

type TestFn = Mocha.Func | Mocha.AsyncFunc;

interface TaggableTestFunction {
  (name: string, fn: Mocha.Func): Mocha.Test;
  (name: string, fn: Mocha.AsyncFunc): Mocha.Test;
  (tags: TemplateStringsArray): (name: string, fn: Mocha.Func) => Mocha.Test;
  (tags: TemplateStringsArray): (name: string, fn: Mocha.AsyncFunc) => Mocha.Test;
}

export let it: TaggableTestFunction;

it = function (tagsOrName: string | TemplateStringsArray, maybeFn?: TestFn) {
  if (typeof tagsOrName === 'string') {
    return global.it(tagsOrName, maybeFn);
  } else {
    return function (name: string, fn: TestFn) {
      const [tags, tagsPrefix] = processTags(tagsOrName);

      function modifiedFn(this: Mocha.Context, done?: Mocha.Done) {
        assertTestsEnabled.call(this, tags);
        fn.call(this, done!);
      }

      const wrappedModifiedFn = (fn.length === 1)
        ? function (this: Mocha.Context, done?: Mocha.Done) { return modifiedFn.call(this, done) }
        : function (this: Mocha.Context) { return modifiedFn.call(this) }

      return global.it(tagsPrefix + ' ' + name, wrappedModifiedFn);
    };
  }
} as any;

type SuiteFn = (this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) => void;

interface TaggableSuiteFunction {
  (name: string, fn: SuiteFn): Mocha.Suite;
  (tags: TemplateStringsArray): (name: string, fn: SuiteFn) => Mocha.Suite;
}

export let describe: TaggableSuiteFunction;

describe = function (tagsOrName: string | TemplateStringsArray, maybeFn?: SuiteFn) {
  const fixtures = initTestObjects();

  if (typeof tagsOrName === 'string') {
    return global.describe(tagsOrName, function () {
      maybeFn?.call(this, fixtures)
    });
  } else {
    return function (name: string, fn: SuiteFn) {
      const [tags, tagsPrefix] = processTags(tagsOrName);

      function modifiedFn(this: Mocha.Suite) {
        before(function () {
          assertTestsEnabled.call(this, tags);
        });

        fn.call(this, fixtures);
      }

      return global.describe(tagsPrefix + ' ' + name, modifiedFn);
    };
  }
} as any;

function processTags(tags: TemplateStringsArray) {
  const tagsArr = tags[0].split(' ');

  const tagsPrefix = tagsArr.map(t => `[${t}]`).join(' ');

  return [tagsArr, tagsPrefix] as const;
}

function assertTestsEnabled(this: Context, tags: string[]) {
  tags.forEach((tag) => {
    if (!['vectorize', 'long', 'admin', 'dev', 'not-dev', 'astra'].includes(tag)) {
      throw new Error(`Unknown test tag, '${tag}'`)
    }
  });

  if (tags.includes('vectorize') && !process.env.ASTRA_RUN_VECTORIZE_TESTS) {
    this.skip();
  }

  if (tags.includes('long') && !process.env.ASTRA_RUN_LONG_TESTS) {
    this.skip();
  }

  if (tags.includes('admin') && !process.env.ASTRA_RUN_ADMIN_TESTS) {
    this.skip();
  }

  if (tags.includes('dev') && !TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    this.skip();
  }

  if (tags.includes('not-dev') && TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    this.skip();
  }

  if (tags.includes('astra') && !TEST_APPLICATION_URI.includes('datastax.com')) {
    this.skip();
  }
}
