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

import type { Projection, SomeRow, Table, TableFilter } from '@/src/documents/index.js';
import { FindAndRerankCursor } from '@/src/documents/index.js';

export class TableFindAndRerankCursor<T, TRaw extends SomeRow = SomeRow> extends FindAndRerankCursor<T, TRaw> {
  public get dataSource(): Table<SomeRow> {
      return super.dataSource as Table<SomeRow>;
  }

  public override filter(filter: TableFilter<TRaw>): this {
    return super.filter(filter);
  }

  declare public project: <RRaw extends SomeRow = Partial<TRaw>>(projection: Projection) => TableFindAndRerankCursor<RRaw, RRaw>;

  declare public map: <R>(map: (doc: T) => R) => TableFindAndRerankCursor<R, TRaw>;
}
