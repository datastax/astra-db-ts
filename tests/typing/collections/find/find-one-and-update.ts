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
// noinspection ExceptionCaughtLocallyJS

import { dummyCollection, TestSchema } from '@/tests/typing/collections/prelude';

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
}, {
  returnDocument: 'after',
});

void dummyCollection<TestSchema>().findOneAndUpdate({
  $vector: [0.25, 0.045, 0.38, 0.31, 0.67],
}, {
  $set: { 'status': 'active' },
  $unset: {
    'status.car': '',
  },
}, {
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
