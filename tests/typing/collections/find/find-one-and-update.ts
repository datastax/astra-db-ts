import { dummyCollection, TestSchema } from '@/tests/typing/collections/prelude';

void dummyCollection<TestSchema>().findOneAndUpdate({
  $vector: [0.25, 0.045, 0.38, 0.31, 0.67],
}, {
  $set: { 'status': 'active' },
}, {
  returnDocument: 'after',
});

void dummyCollection<TestSchema>().findOneAndUpdate({
  '_id': 'upsert-id',
  'amount': 65,
}, {
  $set: {
    $vectorize: '123',
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
  $unset: {
    amount: '',
  },
}, {
  returnDocument: 'after',
});
