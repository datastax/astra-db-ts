import { dummyDB } from '@/tests/typing/collections/prelude';

void dummyDB().createCollection('ASTRA_DB_COLLECTION', {
  vector: {
    dimension: 5,
    metric: 'cosine',
  }
});
