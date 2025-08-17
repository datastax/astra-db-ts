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

import type { SomeRow } from '@/src/documents/tables/types/row.js';
import type { InferTablePrimaryKey, InferTableSchema } from '@/src/db/types/tables/magic.js';
import type { Table } from '@/src/documents/tables/table.js';
import type { Db } from '@/src/db/index.js';
import type { TypeErr } from '@/src/documents/utils.js';

const db = null! as Db;

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
};

const _e: InferTablePrimaryKey<typeof _c> = {
  key: '1',
};

// Demo of type errors that we can provide if you screw something up
const _f = db.createTable('my_table', {
  definition: {
    columns: {
      key: 'int',
    },
    primaryKey: 'id',
  },
});

// const _g: InferTableSchema<typeof _f> = {
//   key: 1,
// };

const _h: InferTablePrimaryKey<typeof _f> = {
  id: {} as TypeErr<'Field `id` not found as property in table definition'>,
};

// Demo of manually providing your own table schema
const _i = db.createTable<SomeRow>('my_table', {
  definition: {
    columns: {},
    primaryKey: 'id',
  },
});

const _j: InferTableSchema<typeof _i> = {
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

type _Proof1 = Expect<Equal<MySchema, {
  key: string,
  age: number,
  car?: Map<string, number>,
}>>;

type MyPK = InferTablePrimaryKey<typeof mkTable>;

type _Proof2 = Expect<Equal<MyPK, {
  key: string,
  bad: TypeErr<'Field `bad` not found as property in table definition'>,
  age: number,
}>>;

await (async () => {
  const myTable: Table<MySchema, MyPK> = await mkTable();

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

  void insertManyResult.insertedIds[1].age;
})();

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;
