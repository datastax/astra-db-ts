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

/* eslint-disable @typescript-eslint/no-unused-vars */

import { dummyCollection, TestSchema } from '@/tests/typing/collections/prelude';
import { Equal, Expect } from '@/tests/typing/prelude';

dummyCollection<TestSchema>().findOne({}, {}).then((_a) => {
  const a = _a!;
  type b = Expect<Equal<undefined, typeof a['$similarity']>>
});

dummyCollection<TestSchema>().findOne({}, { includeSimilarity: true }).then((_a) => {
  const a = _a!;
  type b = Expect<Equal<number[], typeof a['$similarity']>>
});

dummyCollection<TestSchema>().findOne({}, { includeSimilarity: !!Math.random() }).then((_a) => {
  const a = _a!;
  type b = Expect<Equal<undefined | number[], typeof a['$similarity']>>
});

void dummyCollection<TestSchema>().findOne({
  'customer.credit_score': { $gt: 700 },
  $and: [
    { 'customer.age': { $gt: 18 } },
    { 'customer.age': { $lt: 50 } },
    { $not: { 'customer.name': { $in: ['John'] } } }
  ]
}, {
  sort: {
    'customer.address.address_line': 1,
  },
  projection: {
    'customer.name': 1,
    'customer.age': true,
    'customer.credit_score': 0,
  }
});

void dummyCollection<TestSchema>().findOne({}, {
  sort: {
    $vector: [1, 2, 3],
    // @ts-expect-error - Can't sort by vector and other fields at the same time
    'customer.address.address_line': 1,
  },
});
