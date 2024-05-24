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

import { Collection, VectorDoc } from '@/src/data-api';
import { SomeDoc } from '@/src/data-api/types/document';
import { Db } from '@/src/data-api/db';

export interface TestSchema extends VectorDoc {
  _id: string;
  purchase_type: string;
  customer: {
    name: string;
    phone: string | null;
    age: number;
    credit_score: number;
    address: {
      address_line: string;
      city: string;
      state: string;
    };
  };
  purchase_date: Date;
  seller: {
    name: string;
    location: string;
  };
  items: any;
  amount: number;
  status: string;
  preferred_customer?: boolean;
  arr?: { age: number }[];
}

export interface DynamicSchema extends SomeDoc {
  _id: string;
  name: string;
}

export function dummyDB(): Db {
  return null!;
}

export function dummyCollection<T extends SomeDoc>(): Collection<T> {
  return null!;
}
