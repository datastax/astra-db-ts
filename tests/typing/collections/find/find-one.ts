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

import { dummyCollection, DynamicSchema, TestSchema } from '@/tests/typing/collections/prelude';
import { Equal, Expect } from '@/tests/typing/prelude';
import { StrictFilter } from '@/src/data-api/types/filter';
import { StrictProjection } from '@/src/data-api';

void dummyCollection<TestSchema>().findOne({}, {}).then((a) => {
  type b = Expect<Equal<undefined | number, NonNullable<typeof a>['$similarity']>>
});

void dummyCollection<TestSchema>().findOne({}, { includeSimilarity: true }).then((a) => {
  type b = Expect<Equal<undefined | number, NonNullable<typeof a>['$similarity']>>
});

void dummyCollection<TestSchema>().findOne({}, { includeSimilarity: !!Math.random() }).then((a) => {
  type b = Expect<Equal<undefined | number, NonNullable<typeof a>['$similarity']>>
});

void dummyCollection<TestSchema>().findOne({
  'customer.credit_score': { $gt: 700 },
  $and: [
    { 'customer.age': { $gt: 18 } },
    { 'customer.age': { $lt: 50 } },
    { $not: { 'customer.name': { $in: ['John'] } } },
    { 'purchase_date': new Date(123) },
  ],
  'purchase_date': { $gte: new Date(123) },
  'items': { $gte: new Date(123) },
  'arr.0': { age: 3 },
  'arr.0.age': 3,
}, {
  sort: {
    'customer.address.address_line': 1,
  },
  projection: {
    'customer.name': 1,
    'customer.age': true,
    'customer.credit_score': 0,
    'items': { $slice: 1 },
  }
});

void dummyCollection<TestSchema>().findOne({
  'customer.credit_score': { $gt: 700 },
  $and: [
    { 'customer.age': { $gt: 18 } },
    { 'customer.age': { $lt: 50 } },
    { $not: { 'customer.name': { $in: ['John'] } } },
    { 'purchase_date': new Date(123) },
  ],
  'purchase_date': { $gte: new Date(123) },
  'items': { $gte: new Date(123) },
  'arr.0': { age: 3 },
} satisfies StrictFilter<TestSchema>, {
  sort: {
    'customer.address.address_line': 1,
  },
  projection: {
    'customer.name': 1,
    'customer.age': true,
    'customer.credit_score': 0,
    'items': { $slice: 1 },
  }
});

void dummyCollection<TestSchema>().findOne({
  'customer.credit_score': {
    $date: 700,
  },
  'customer.name': {
    $eq: 18,
  },
  'customer.age': {
    $in: [
      102,
      '1',
    ],
  },
  'arr.0': ['123'],
});

void dummyCollection<TestSchema>().findOne({
  'customer.credit_score': {
    // @ts-expect-error - Can't use $date with non-date fields
    $date: 700,
  },
  'customer.name': {
    // @ts-expect-error - Type mismatch
    $eq: 18,
  },
  'customer.age': {
    $in: [
      102,
      // @ts-expect-error - Type mismatch
      '1',
    ],
  },
  // @ts-expect-error - Type mismatch
  'arr.0': ['123'],
} satisfies StrictFilter<TestSchema>);

void dummyCollection<TestSchema>().findOne({}, {
  sort: {
    $vector: [1, 2, 3],
    'customer.address.address_line': 1,
  },
});

void dummyCollection<TestSchema>().findOne({}, {
  projection: {
    // Technically not valid, but it's just for type testing
    $vector: {
      $slice: [
        1,
        // @ts-expect-error - Must be a number
        '2',
      ]
    },
  },
});


void dummyCollection<TestSchema>().findOne({}, {
  projection: {
    // @ts-expect-error - Can't use $slice with non-array fields
    'customer.address.city': { $slice: 1 },
  } satisfies StrictProjection<TestSchema>,
});

void dummyCollection<DynamicSchema>().findOne({
  // @ts-expect-error - Type mismatch
  _id: 23,
});
