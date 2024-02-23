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
