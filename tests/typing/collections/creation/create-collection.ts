import { dummyDB, TestSchema } from '@/tests/typing/collections/prelude';

void dummyDB().createCollection<TestSchema>('ASTRA_DB_COLLECTION', {
  indexing: {
    deny: ['customer.credit_score'],
    // @ts-expect-error - Can't deny and allow at the same time
    allow: ['*'],
  },
});

void dummyDB().createCollection<TestSchema>('ASTRA_DB_COLLECTION', {
  indexing: {
    allow: ['*'],
    // @ts-expect-error - Can't deny and allow at the same time
    deny: ['customer.credit_score'],
  },
});

void dummyDB().createCollection<TestSchema>('ASTRA_DB_COLLECTION', {
  indexing: {
    allow: [
      'customer.credit_score',
      // @ts-expect-error - Can't wildcard and specify fields at the same time
      '*',
    ],
  },
});

void dummyDB().createCollection<TestSchema>('ASTRA_DB_COLLECTION', {
  // @ts-expect-error - Need to specify either allow or deny
  indexing: {},
});

void dummyDB().createCollection<TestSchema>('ASTRA_DB_COLLECTION', {
  indexing: {
    // @ts-expect-error - No invalid fields
    anyRandomField: 'no',
  },
});

void dummyDB().createCollection<TestSchema>('ASTRA_DB_COLLECTION', {
  vector: {
    dimension: 5,
    metric: 'cosine',
    // @ts-expect-error - No invalid fields
    anyRandomField: 'no',
  },
});

void dummyDB().createCollection<TestSchema>('ASTRA_DB_COLLECTION', {
  vectorize: {
    service: 'openai',
    options: {
      anyRandomField: { yes: 'unkown for now' },
    },
    // @ts-expect-error - No invalid fields
    anyRandomField: 'no',
  }
});
