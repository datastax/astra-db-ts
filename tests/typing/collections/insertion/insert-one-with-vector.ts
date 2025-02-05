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

import type { TestSchema } from '@/tests/typing/collections/prelude.js';
import { dummyCollection } from '@/tests/typing/collections/prelude.js';

void dummyCollection<TestSchema>().insertOne({
  '_id': '1',
  'purchase_type': 'Online',
  '$vector': [0.25, 0.25, 0.25, 0.25, 0.25],
  'customer': {
    'name': 'Jim A.',
    'phone': '123-456-1111',
    'age': 51,
    'credit_score': 782,
    'address': {
      'address_line': '1234 Broadway',
      'city': 'New York',
      'state': 'NY',
    },
  },
  'purchase_date': new Date(1690045891),
  'seller': {
    'name': 'Jon B.',
    'location': 'Manhattan NYC',
  },
  'items': [
    {
      'car': 'BMW 330i Sedan',
      'color': 'Silver',
    },
    'Extended warranty - 5 years',
  ],
  'amount': 47601,
  'status': 'active',
  'preferred_customer': true,
  'arr': [],
});
