import { Collection } from '@/src/collections';
import { SomeDoc } from '@/src/collections/document';
import { Db } from '@/src/collections/db';

export interface TestSchema {
  _id: string;
  purchase_type: string;
  $vector: number[];
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
  purchase_date: { $date: number };
  seller: {
    name: string;
    location: string;
  };
  items: any;
  amount: number;
  status: string;
  preferred_customer?: boolean;
}

export function dummyDB(): Db {
  return null!;
}

export function dummyCollection<T extends SomeDoc>(): Collection<T> {
  return null!;
}
