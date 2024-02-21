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

export type SortOption =
  | Record<string, 1 | -1>
  | { $vector: { $meta: Array<number> } }
  | { $vector: Array<number> };

export type ProjectionOption = Record<
  string,
  1 | 0 | true | false | { $slice: number }
>;

export interface FindOneAndResult<Schema extends AnyDict> {
  value: Schema | null;
  ok: number;
}
