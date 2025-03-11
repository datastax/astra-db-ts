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

import type { Collection, CollectionFilter, Projection, SomeDoc, WithSim } from '@/src/documents/index.js';
import { FindCursor } from '@/src/documents/cursors/find-cursor.js';

export class CollectionFindCursor<T, TRaw extends SomeDoc = SomeDoc> extends FindCursor<T, TRaw> {
  public get dataSource(): Collection {
      return super.dataSource as Collection;
  }

  public override filter(filter: CollectionFilter<TRaw>): this {
    return super.filter(filter);
  }

  declare public project: <RRaw extends SomeDoc = Partial<TRaw>>(projection: Projection) => CollectionFindCursor<RRaw, RRaw>;

  declare public includeSimilarity: (includeSimilarity?: boolean) => CollectionFindCursor<WithSim<TRaw>, WithSim<TRaw>>;

  declare public map: <R>(map: (doc: T) => R) => CollectionFindCursor<R, TRaw>;
}
