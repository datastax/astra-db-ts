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

import { SomeDoc } from '@/src/collections/document';
import { ToDotNotation } from '@/src/collections/operations/dot-notation';

export type SortOption<Schema extends SomeDoc> =
  | { [K in keyof ToDotNotation<Schema>]?: 1 | -1 }
  | { $vector: { $meta: number[] } }
  | { $vector: number[] }
  | { $vectorize: string };

export type ProjectionOption<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<Schema>]?: 1 | 0 | true | false | { $slice: number };
};

export interface FindOneAndResult<Schema extends SomeDoc> {
  value: Schema | null;
  ok: number;
}
