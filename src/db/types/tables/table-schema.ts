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

import { $PrimaryKeyType } from '@/src/documents/tables/types/row';
import { Table } from '@/src/documents/tables/table';
import {
  CreateTableColumnDefinitions,
  CreateTableDefinition,
  CreateTablePrimaryKeyDefinition,
  FullCreateTablePrimaryKeyDefinition,
} from '@/src/db/types/tables/create-table';
import { EmptyObj } from '@/src/lib/types';

type InferrableRow =
  | ((..._: any[]) => Promise<Table>)
  | ((..._: any[]) => Table)
  | CreateTableDefinition
  | Promise<Table>
  | Table;

export type InferTableSchema<T extends InferrableRow> = Normalize<_InferTableSchema<T>>;

type Normalize<T> = { [K in keyof T]: T[K] };

type _InferTableSchema<T extends InferrableRow> =
  T extends (..._: any[]) => Promise<Table<infer Schema>>
    ? Schema :
  T extends (..._: any[]) => Table<infer Schema>
    ? Schema :
  T extends CreateTableDefinition
    ? InferTableSchemaFromDefinition<T> :
  T extends Promise<Table<infer Schema>>
    ? Schema :
  T extends Table<infer Schema>
    ? Schema
    : never;

export type InferTableSchemaFromDefinition<FullDef extends CreateTableDefinition, Schema = Cols2CqlTypes<FullDef['columns']>> = Schema & {
  [$PrimaryKeyType]?: MkPrimaryKeyType<FullDef, Schema>,
}

type MkPrimaryKeyType<FullDef extends CreateTableDefinition, Schema, PK extends FullCreateTablePrimaryKeyDefinition = NormalizePK<FullDef['primaryKey']>> = Normalize<
  {
    -readonly [P in PK['partitionKey'][number]]: P extends keyof Schema ? Schema[P] : `ERROR: Field \`${P}\` not found as property in table definition`;
  }
  & (PK['partitionSort'] extends Record<string, 1 | -1>
    ? {
      -readonly [P in keyof PK['partitionSort']]: P extends keyof Schema ? Schema[P] : `ERROR: Field \`${P & string}\` not found as property in table definition`;
    }
    : EmptyObj)
>

type NormalizePK<PK extends CreateTablePrimaryKeyDefinition> =
  PK extends string
    ? { partitionKey: [PK] }
    : PK;

export type Cols2CqlTypes<Columns extends CreateTableColumnDefinitions> = {
  -readonly [P in keyof Columns]: CqlType2TSType<InferColDefType<Columns[P]>, Columns[P]>;
};

type InferColDefType<Def> =
  Def extends { type: infer Type }
    ? Type
    : Def;

type CqlType2TSType<T, Def> =
  T extends 'text' | 'ascii' | 'varchar'
    ? string :
  T extends 'int' | 'double' | 'float' | 'smallint' | 'tinyint'
    ? number :
  T extends 'boolean'
    ? boolean :
  T extends 'varint'
    ? bigint :
  T extends 'map'
    ? CqlMapType2TsType<Def> :
  T extends 'list' | 'vector'
    ? CqlListType2TsType<Def> :
  T extends 'set'
    ? CqlSetType2TsType<Def>
    : unknown;

type CqlMapType2TsType<Def> =
  Def extends { keyType: infer KeyType, valueType: infer ValueType }
    ? Map<CqlType2TSType<KeyType, never>, CqlType2TSType<ValueType, never>>
    : 'Error: invalid generics definition for \'map\'; should have keyType and valueType set';

type CqlListType2TsType<Def> =
  Def extends { valueType: infer ValueType }
    ? Array<CqlType2TSType<ValueType, never>>
    : 'Error: invalid generics definition for \'list/vector\'; should have valueType set';

type CqlSetType2TsType<Def> =
  Def extends { valueType: infer ValueType }
    ? Set<CqlType2TSType<ValueType, never>>
    : 'Error: invalid generics definition for \'set\'; should have valueType set';
