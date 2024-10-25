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

import { WithTimeout } from '@/src/lib/types';
import { FullCreateTablePrimaryKeyDefinition, StrictCreateTableColumnDefinition, WithKeyspace } from '@/src/db';

export interface ListTablesOptions extends WithTimeout, WithKeyspace {
  nameOnly?: boolean,
}

export interface FullTableInfo {
  name: string,
  definition: ListTableDefinition[],
}

export interface ListTableDefinition {
  columns: ListTableColumnDefinitions,
  primaryKey: ListTablePrimaryKeyDefinition,
}

export type ListTableColumnDefinitions = Record<string, ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition>;

export type ListTableKnownColumnDefinition = StrictCreateTableColumnDefinition;

export interface ListTableUnsupportedColumnDefinition {
  type: 'UNSUPPORTED',
  apiSupport: ListTableUnsupportedColumnApiSupport,
}

export interface ListTableUnsupportedColumnApiSupport {
  createTable: boolean,
  insert: boolean,
  read: boolean,
  cqlDefinition: string,
}

export type ListTablePrimaryKeyDefinition = Required<FullCreateTablePrimaryKeyDefinition>;
