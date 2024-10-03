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
import { CreateTableColumnDefinition } from '@/src/db';

export interface AlterTableOptions<Schema extends SomeRow> {
  operation: AlterTableOperations<Schema>,
  ifExists: boolean,
}

export interface AlterTableOperations<Schema extends SomeRow> {
  alterType: AlterTypeOperation<Schema>,
  add: AddColumnOperation,
  drop: DropColumnOperation<Schema>,
  rename: RenameColumnOperation<Schema>,
}

export interface AlterTypeOperation<Schema extends SomeRow> {
  column: keyof Schema,
  type: 'TODO',
  ifNotExists: boolean,
}

export interface AddColumnOperation {
  columns: Record<string, CreateTableColumnDefinition>
  ifExists: boolean,
}

export interface DropColumnOperation<Schema extends SomeRow> {
  columns: (keyof Schema)[];
  ifExists: boolean,
}

export interface RenameColumnOperation<Schema extends SomeRow> {
  columns: Record<keyof Schema, string>
  ifExists: boolean,
}
