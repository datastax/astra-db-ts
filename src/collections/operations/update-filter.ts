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

export interface UpdateFilter<Schema extends AnyDict, InNotation = DotNotation<Schema>> {
  $set?: Partial<InNotation>,
  $setOnInsert?: Partial<InNotation>,
  $unset?: {
    [K in keyof InNotation]?: ''
  },
  $inc?: NumberUpdate<InNotation>,
  $push?: ArrayUpdate<InNotation>,
  $pop?: {
    [K in keyof ArrayUpdate<InNotation>]?: number
  },
  $rename?: {
    [K in keyof InNotation]?: string
  },
  $currentDate?: {
    [K in keyof InNotation as Date extends InNotation[K] ? K : never]?: true
  },
  $min?: NumberUpdate<InNotation>,
  $max?: NumberUpdate<InNotation>,
  $mul?: NumberUpdate<InNotation>,
  $addToSet?: ArrayUpdate<InNotation>,
}

type NumberUpdate<Schema> = {
  [K in keyof Schema as number extends Schema[K] ? K : never]?: number
}

type ArrayUpdate<Schema> = {
  [K in keyof Schema as any[] extends Schema[K] ? K : never]?: Schema[K] extends (infer E)[] ? E : never
}
