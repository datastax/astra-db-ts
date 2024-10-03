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

import { VectorizeServiceOptions } from '@/src/db';
import { WithTimeout } from '@/src/lib';
import { TableSpawnOptions } from '@/src/db/types/tables/spawn-table';

export interface CreateTableOptions<Def extends CreateTableDefinition = CreateTableDefinition> extends WithTimeout, TableSpawnOptions {
  definition: Def,
  checkExists?: boolean,
}

export interface CreateTableDefinition {
  columns: Record<string, CreateTableColumnDefinition>,
  primaryKey: CreateTablePrimaryKeyDefinition,
}

type CreateTableColumnDefinition =
  | LooseCreateTableColumnDefinition
  | StrictCreateTableColumnDefinition

type TableScalarType =
  | 'text'
  | 'int'
  | 'double'
  | 'float'
  | 'ascii'
  | 'smallint'
  | 'tinyint'
  | 'varchar'
  | 'varint'
  | 'boolean';

type LooseCreateTableColumnDefinition =
  | TableScalarType
  | string;

type StrictCreateTableColumnDefinition =
  | ScalarCreateTableColumnDefinition
  | MapCreateTableColumnDefinition
  | ListCreateTableColumnDefinition
  | SetCreateTableColumnDefinition
  | VectorCreateTableColumnDefinition;

interface ScalarCreateTableColumnDefinition {
  type: TableScalarType,
}

interface MapCreateTableColumnDefinition {
  type: 'map',
  keyType: TableScalarType,
  valueType: TableScalarType,
}

interface ListCreateTableColumnDefinition {
  type: 'list',
  valueType: TableScalarType,
}

interface SetCreateTableColumnDefinition {
  type: 'set',
  valueType: TableScalarType,
}

interface VectorCreateTableColumnDefinition {
  type: 'vector',
  valueType: TableScalarType,
  dimensions?: number[],
  service: VectorizeServiceOptions,
}

export type CreateTablePrimaryKeyDefinition =
  | ShortCreateTablePrimaryKeyDefinition
  | FullCreateTablePrimaryKeyDefinition;

export type ShortCreateTablePrimaryKeyDefinition = string;

export interface FullCreateTablePrimaryKeyDefinition {
  partitionKey: string[],
  partitionSort?: Record<string, 1 | -1>,
}
