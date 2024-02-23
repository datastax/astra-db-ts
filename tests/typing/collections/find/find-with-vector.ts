import { dummyCollection, TestSchema } from '@/tests/typing/collections/prelude';

void dummyCollection<TestSchema>().find({}, {
  limit: 100,
  sort: {
    $vector: [0.15, 0.1, 0.1, 0.35, 0.55],
  },
});
