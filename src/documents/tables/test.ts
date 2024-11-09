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

import { $PrimaryKeyType, Row, SomeRow } from '@/src/documents/tables/types/row';
import { InferTableSchema } from '@/src/db/types/tables/table-schema';
import { Table } from '@/src/documents/tables/table';
import { KeyOf } from '@/src/documents/tables/types/utils';
import { Db } from '@/src/db';
import { TypeErr } from '@/src/documents/utils';

const db = null! as Db;

// Demo of automagically creating a primary key type for your manually created schema
interface Users extends Row<Users, 'key' | 'age'> {
  key: string,
  age: number,
  car: string,
}

const _a: KeyOf<Users> = {
  key: 'abc',
  age: 31,
};

// Demo of the lawless world of weak typing
const _b: KeyOf<SomeRow> = {
  some: 'thing',
  any: 'thing',
};

// Demo of automagically inferring your table schema's type
const _c = db.createTable('my_table', {
  definition: {
    columns: {
      key: 'text',
      age: {
        type: 'int',
      },
      car: {
        type: 'map',
        keyType: 'text',
        valueType: 'int',
      },
    },
    primaryKey: 'key',
  },
});

const _d: InferTableSchema<typeof _c> = {
  key: 'a',
  age: 3,
  car: new Map(),
  [$PrimaryKeyType]: {
    key: '1',
  },
};

// Demo of type errors that we can provide if you screw something up
const _e = db.createTable('my_table', {
  definition: {
    columns: {
      key: 'int',
    },
    primaryKey: 'id',
  },
});

const _f: InferTableSchema<typeof _e> = {
  key: 1,
  [$PrimaryKeyType]: {
    id: {} as TypeErr<'Field `id` not found as property in table definition'>,
  },
};

// Demo of manually providing your own table schema
const _g = db.createTable<SomeRow>('my_table', {
  definition: {
    columns: {},
    primaryKey: 'id',
  },
});

const _h: InferTableSchema<typeof _g> = {
  whatever: 'I want',
};

// Better demo of automagically inferring your table schema's type
const mkTable = () => db.createTable('my_table', {
  definition: {
    columns: {
      key: 'text',
      age: {
        type: 'int',
      },
      car: {
        type: 'map',
        keyType: 'text',
        valueType: 'int',
      },
    },
    primaryKey: {
      partitionBy: ['key', 'bad'],
      partitionSort: { age: -1 },
    },
  },
});

type MySchema = InferTableSchema<typeof mkTable>;

type _Proof = Expect<Equal<MySchema, {
  key: string,
  age: number,
  car?: Map<string, number>,
  [$PrimaryKeyType]?: {
    key: string,
    bad: TypeErr<'Field `bad` not found as property in table definition'>,
    age: number,
  },
}>>;

(async () => {
  const myTable = await mkTable();

  const insertManyResult = await myTable.insertMany([
    {
      age: 3,
      car: new Map(),
      key: '3',
    },
    {
      age: 53,
      car: new Map(),
      key: 'hi!',
    },
  ]);

  type _ = Expect<Equal<typeof insertManyResult, {
    insertedIds: ({
      key: string,
      bad: TypeErr<'Field `bad` not found as property in table definition'>,
      age: number,
    })[],
    insertedCount: number,
  }>>;

  console.log(insertManyResult.insertedIds[1].age);
})();

(async () => {
  const myTable = await mkTable();

  const _altered1 = await myTable.alter({
    operation: {},
  });

  type _1 = Expect<Equal<typeof _altered1, Table<{
    key: string,
    age: number,
    car?: Map<string, number>,
    [$PrimaryKeyType]?: {
      key: string,
      bad: TypeErr<'Field `bad` not found as property in table definition'>,
      age: number,
    },
  }>>>;

  const _altered2 = await myTable.alter({
    operation: { add: { columns: { new: 'varchar' } } },
  });

  type _2 = Expect<Equal<typeof _altered2, Table<{
    key: string,
    age: number,
    car?: Map<string, number>,
    new?: string | null,
    [$PrimaryKeyType]?: {
      key: string,
      bad: TypeErr<'Field `bad` not found as property in table definition'>,
      age: number,
    },
  }>>>;

  const _altered3 = await myTable.alter({
    operation: { add: { columns: { new: { type: 'list', valueType: 'boolean' } } } },
  });

  type _3 = Expect<Equal<typeof _altered3, Table<{
    key: string,
    age: number,
    car?: Map<string, number>,
    new?: boolean[],
    [$PrimaryKeyType]?: {
      key: string,
      bad: TypeErr<'Field `bad` not found as property in table definition'>,
      age: number,
    },
  }>>>;

  const _altered4 = await myTable.alter({
    operation: { drop: { columns: ['car'] } },
  });

  type _4 = Expect<Equal<typeof _altered4, Table<{
    key: string,
    age: number,
    [$PrimaryKeyType]?: {
      key: string,
      bad: TypeErr<'Field `bad` not found as property in table definition'>,
      age: number,
    },
  }>>>;

  const _altered5 = await myTable.alter<{ a: 4 }>({
    operation: { drop: { columns: ['car'] } },
  });

  type _5 = Expect<Equal<typeof _altered5, Table<{ a: 4 }>>>;
})();

// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;
