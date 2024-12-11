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
