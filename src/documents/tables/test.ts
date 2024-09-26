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

import { $PrimaryKeyType, Row, TableKey } from "@/src/documents/tables/types/row";
import { SomeDoc } from "@/src/documents";
import { InferTableSchema, InferTableSchemaFromDefinition } from "@/src/db/types/tables/table-schema";
import { CreateTableDefinition } from "@/src/db/types/tables/create-table";
import { Table } from "@/src/documents/tables/table";

const db = { createTable };

// Demo of automagically creating a primary key type for your manually created schema
interface Users extends Row<Users, ['key', 'age']> {
  key: string,
  age: number,
  car: string,
}

const _a: TableKey<Users> = {
  key: 'abc',
  age: 31,
};

// Demo of the lawless world of weak typing
const _b: TableKey<SomeDoc> = {
  some: 'thing',
  any: 'thing',
};

// Demo of automagically inferring your table schema's type
const _c = createTable('my_table', {
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
const _e = createTable('my_table', {
  columns: {
    key: 'int',
  },
  primaryKey: 'id',
});

const _f: InferTableSchema<typeof _e> = {
  key: 1,
  [$PrimaryKeyType]: {
    id: 'ERROR: Field `id` not found as property in table definition',
  },
};

// Demo of manually providing your own table schema
const _g = createTable<SomeDoc>('my_table', {
  columns: {},
  primaryKey: 'id',
});

const _h: InferTableSchema<typeof _g> = {
  whatever: 'I want',
};

// Better demo of automagically inferring your table schema's type
const mkTable = () => db.createTable('my_table', {
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
    partitionKey: ['key', 'bad'],
    partitionSort: { age: -1 },
  },
});

type MySchema = InferTableSchema<typeof mkTable>;

type Proof = Expect<Equal<MySchema, {
  key: string,
  age: number,
  car: Map<string, number>,
} & {
  [$PrimaryKeyType]?: {
    key: string,
    bad: 'ERROR: Field `bad` not found as property in table definition',
  } & {
    age: number,
  },
}>>;

// insertMany example
(async () => {
  const myTable = await mkTable();

  const insertManyResult = myTable.insertMany<MySchema>([
    {
      age: 3,
      car: new Map(),
      key: '3',
    },
    {
      age: 53,
      car: new Map(),
      key: 'hiii',
    },
  ]);

  type __ = Expect<Equal<typeof insertManyResult, {
    insertedIds: ({
      key: string,
      bad: 'ERROR: Field `bad` not found as property in table definition',
    } & {
      age: number,
    })[],
  }>> & Proof;

  console.log(insertManyResult.insertedIds[1].age);
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

function createTable<_ extends 'infer', const Def extends CreateTableDefinition>(_: string, __: Def): Promise<Table<InferTableSchemaFromDefinition<Def>>>

function createTable<T extends SomeDoc>(_: string, __: CreateTableDefinition): Promise<Table<T>>

function createTable(_: string, __: CreateTableDefinition): unknown {
  throw 'stub';
}

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;
