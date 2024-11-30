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

import { TableIndexOptions, TableVectorIndexOptions } from '@/src/documents';
import { WithTimeout } from '@/src/lib';

export interface ListIndexOptions extends WithTimeout<'tableAdminTimeoutMs'> {
  nameOnly?: boolean,
}

export interface TableIndexDescriptor {
  name: string,
  definition: TableNormalIndexDescriptor | TableVectorIndexDescriptor | TableUnknownIndex,
}

interface TableNormalIndexDescriptor {
  column: string,
  options: TableIndexOptions,
}

interface TableVectorIndexDescriptor {
  column: string,
  options: TableVectorIndexOptions,
}

interface TableUnknownIndex {
  column: 'UNKNOWN',
  apiSupport: TableIndexUnsupportedColumnApiSupport,
}

interface TableIndexUnsupportedColumnApiSupport {
  createIndex: boolean,
  filter: boolean,
  cqlDefinition: string,
}
