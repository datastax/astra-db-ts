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

import { AnyDict } from '@/src/collections/collection';
import { DotNotation } from '@/src/collections/operations/dot-notation';

export type Filter<Schema extends AnyDict> = {
  [K in keyof DotNotation<Schema>]?: FilterType<DotNotation<Schema>[K]>
} & {
  $and?: Filter<Schema>[],
  $or?: Filter<Schema>[],
}

type FilterType<Elem> = Elem | FilterOps<Elem>;

type FilterOps<Elem> = {
  $eq?: Elem,
  $ne?: Elem,
  $in?: Elem[],
  $nin?: Elem[],
  $exists?: boolean,
} & (
  number extends Elem ? NumFilterOps : {}
) & (
  any[] extends Elem ? ArrayFilterOps<Elem> : {}
)

interface NumFilterOps {
  $lt?: number,
  $lte?: number,
  $gt?: number,
  $gte?: number,
}

interface ArrayFilterOps<Elem> {
  $size?: number,
  $all?: Elem,
}
