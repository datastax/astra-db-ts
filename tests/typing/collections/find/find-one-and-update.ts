import { dummyCollection, TestSchema } from '@/tests/typing/collections/prelude';
import { StrictUpdateFilter } from '@/src/data-api/types';

void dummyCollection<TestSchema>().findOneAndUpdate({
  $vector: [0.25, 0.045, 0.38, 0.31, 0.67],
}, {
  $set: { 'status': 'active' },
  $unset: { 'status.car': '' },
}, {
  returnDocument: 'after',
});

void dummyCollection<TestSchema>().findOneAndUpdate({
  $vector: [0.25, 0.045, 0.38, 0.31, 0.67],
}, {
  $set: { 'status': 'active' },
} satisfies StrictUpdateFilter<TestSchema>, {
  returnDocument: 'after',
});

void dummyCollection<TestSchema>().findOneAndUpdate({
  $vector: [0.25, 0.045, 0.38, 0.31, 0.67],
}, {
  $set: { 'status': 'active' },
  $unset: {
    // @ts-expect-error - 'status.car' is not a valid field
    'status.car': '',
  },
  // @ts-expect-error - 'status.car' is not a valid field
} satisfies StrictUpdateFilter<TestSchema>, {
  returnDocument: 'after',
});

void dummyCollection<TestSchema>().findOneAndUpdate({
  '_id': 'upsert-id',
  'amount': 65,
}, {
  $set: {
    items: Symbol('123'),
    'customer.phone': '123-456-7890',
  },
}, {
  returnDocument: 'after',
  upsert: true,
});


void dummyCollection<TestSchema>().findOneAndUpdate({
  '_id': 'upsert-id',
  'amount': 65,
}, {
  $set: {
    items: Symbol('123'),
    'customer.phone': '123-456-7890',
  },
} satisfies StrictUpdateFilter<TestSchema>, {
  returnDocument: 'after',
  upsert: true,
});

void dummyCollection<TestSchema>().findOneAndUpdate({
  '_id': 'upsert-id',
  'amount': 65,
}, {
  $unset: {
    amount: '',
  },
}, {
  returnDocument: 'after',
});

void dummyCollection<TestSchema>().findOneAndUpdate({
  '_id': 'upsert-id',
  'amount': 65,
}, {
  $unset: {
    amount: '',
  },
} satisfies StrictUpdateFilter<TestSchema>, {
  returnDocument: 'after',
});
