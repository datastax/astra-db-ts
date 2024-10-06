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
import { UUID, InetAddress, CqlDate, CqlDuration, CqlTime, CqlTimestamp } from '@/src/documents';

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

type CqlType2TSType<T extends string, Def> =
  T extends keyof CqlNonGenericType2TSTypeDict
    ? CqlNonGenericType2TSTypeDict[T] :
  T extends keyof CqlGenericType2TSTypeDict<Def>
    ? CqlGenericType2TSTypeDict<Def>[T]
    : unknown;

interface CqlNonGenericType2TSTypeDict {
  text: string;
  ascii: string,
  varchar: string,
  int: number,
  double: number,
  float: number,
  smallint: number,
  tinyint: number,
  boolean: boolean,
  varint: bigint,
  date: CqlDate,
  duration: CqlDuration,
  time: CqlTime,
  timestamp: CqlTimestamp,
  uuid: UUID,
  timeuuid: UUID,
  inet: InetAddress,
}

interface CqlGenericType2TSTypeDict<Def> {
  map: CqlMapType2TsType<Def>,
  list: CqlListType2TsType<Def>,
  vector: CqlListType2TsType<Def>,
  set: CqlSetType2TsType<Def>,
}

type CqlMapType2TsType<Def> =
  Def extends { keyType: infer KeyType extends string, valueType: infer ValueType extends string }
    ? Map<CqlType2TSType<KeyType, never>, CqlType2TSType<ValueType, never>>
    : 'Error: invalid generics definition for \'map\'; should have keyType and valueType set as scalar CQL types (e.g. \'text\')';

type CqlListType2TsType<Def> =
  Def extends { valueType: infer ValueType extends string }
    ? Array<CqlType2TSType<ValueType, never>>
    : 'Error: invalid generics definition for \'list/vector\'; should have valueType set as scalar CQL types (e.g. \'text\')';

type CqlSetType2TsType<Def> =
  Def extends { valueType: infer ValueType extends string }
    ? Set<CqlType2TSType<ValueType, never>>
    : 'Error: invalid generics definition for \'set\'; should have valueType set as scalar CQL types (e.g. \'text\')';
