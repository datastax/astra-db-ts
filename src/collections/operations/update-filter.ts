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
import { ToDotNotation } from '@/src/collections/operations/dot-notation';

export interface UpdateFilter<Schema extends AnyDict, InNotation = ToDotNotation<Schema>> {
  $set?: Partial<InNotation>,
  $setOnInsert?: Partial<InNotation>,
  $unset?: Unset<InNotation>,
  $inc?: NumberUpdate<InNotation>,
  $push?: ArrayUpdate<InNotation>,
  $pop?: Pop<InNotation>,
  $rename?: Rename<InNotation>,
  $currentDate?: CurrentDate<InNotation>,
  $min?: NumberUpdate<InNotation>,
  $max?: NumberUpdate<InNotation>,
  $mul?: NumberUpdate<InNotation>,
  $addToSet?: ArrayUpdate<InNotation>,
}

type Unset<Schema> = {
  [K in keyof Schema]?: ''
}

type Pop<Schema> = {
  [K in keyof ArrayUpdate<Schema>]?: number
}

type Rename<Schema> = {
  [K in keyof Schema]?: string
}

type IsNumber<T> = number extends T ? true : bigint extends T ? true : false

type NumberUpdate<Schema> = {
  [K in keyof Schema as IsNumber<Schema[K]> extends true ? K : never]?: number
}

type ArrayUpdate<Schema> = {
  [K in keyof Schema as any[] extends Schema[K] ? K : never]?: Schema[K] extends (infer E)[] ? E : unknown
}

type CurrentDate<Schema> = {
  [K in keyof Schema as Date extends Schema[K] ? K : never]?: true
}
