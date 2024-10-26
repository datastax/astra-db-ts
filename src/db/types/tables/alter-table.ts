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

import { Cols, SomeRow } from '@/src/documents';
import { Cols2CqlTypes, CreateTableColumnDefinitions, Normalize, VectorizeServiceOptions } from '@/src/db';
import { WithTimeout } from '@/src/lib';
import { EmptyObj } from '@/src/lib/types';

export interface AlterTableOptions<Schema extends SomeRow> extends WithTimeout {
  operation: AlterTableOperations<Schema>,
  // ifExists?: boolean,
}

export interface AlterTableOperations<Schema extends SomeRow> {
  add?: AddColumnOperation,
  drop?: DropColumnOperation<Schema>,
  addVectorize?: AddVectorizeOperation<Schema>,
  dropVectorize?: DropVectorizeOperation<Schema>,
}

export interface AddColumnOperation {
  columns: CreateTableColumnDefinitions
  // ifNotExists?: boolean,
}

export interface DropColumnOperation<Schema extends SomeRow> {
  columns: Cols<Schema>[];
  // ifExists?: boolean,
}

export interface AddVectorizeOperation<Schema extends SomeRow> {
  columns: Record<Cols<Schema>, VectorizeServiceOptions>
}

export interface DropVectorizeOperation<Schema extends SomeRow> {
  columns: Cols<Schema>[];
  // ifExists?: boolean,
}

export type AlterTableSchema<Schema extends SomeRow, Alter extends AlterTableOptions<Schema>> = Normalize<Omit<
  Schema & Cols2Add<Alter['operation']['add']>,
  Cols2Drop<Alter['operation']['drop']>
>>;

export type Cols2Add<Op extends AddColumnOperation | undefined> = Op extends AddColumnOperation
  ? Partial<Cols2CqlTypes<Op["columns"]>>
  : EmptyObj;

export type Cols2Drop<Op> = Op extends { columns: (infer U)[] }
  ? U
  : never;
