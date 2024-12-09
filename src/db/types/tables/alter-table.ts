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

import { SomeRow } from '@/src/documents';
import { CreateTableColumnDefinitions, VectorizeServiceOptions } from '@/src/db';
import { WithTimeout } from '@/src/lib';

export interface AlterTableOptions<Schema extends SomeRow> extends WithTimeout<'tableAdminTimeoutMs'> {
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
  columns: (keyof Schema)[];
  // ifExists?: boolean,
}

export interface AddVectorizeOperation<Schema extends SomeRow> {
  columns: Partial<Record<keyof Schema, VectorizeServiceOptions>>,
}

export interface DropVectorizeOperation<Schema extends SomeRow> {
  columns: (keyof Schema)[];
  // ifExists?: boolean,
}
