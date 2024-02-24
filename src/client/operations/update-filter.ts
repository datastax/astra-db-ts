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

import { ToDotNotation } from '@/src/client/operations/dot-notation';
import { IsNum } from '@/src/client/operations/utils';
import { TypeErr } from '@/src/client/utils';
import { SomeDoc } from '@/src/client/document';

export interface UpdateFilter<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> {
  $set?: Partial<InNotation>,
  $setOnInsert?: Partial<InNotation>,
  $unset?: Unset<InNotation>,
  $inc?: NumberUpdate<InNotation>,
  $push?: Push<InNotation>,
  $pop?: Pop<InNotation>,
  $rename?: Rename<InNotation>,
  $currentDate?: CurrentDate<InNotation>,
  $min?: NumberUpdate<InNotation>,
  $max?: NumberUpdate<InNotation>,
  $mul?: NumberUpdate<InNotation>,
  $addToSet?: Push<InNotation>,
}

type Unset<Schema> = {
  [K in keyof Schema]?: ''
}

type Pop<Schema> = ContainsArr<Schema> extends true ? {
  [K in keyof ArrayUpdate<Schema>]?: number
} : TypeErr<'Can not pop on a schema with no arrays'>

type Push<Schema> = ContainsArr<Schema> extends true ? {
  [K in keyof ArrayUpdate<Schema>]?: (
    | ArrayUpdate<Schema>[K]
    | { $each: ArrayUpdate<Schema>[K][], $position?: number }
  )
} : TypeErr<'Can not perform array operation on a schema with no arrays'>

type Rename<Schema> = {
  [K in keyof Schema]?: string
}

type NumberUpdate<Schema> = ContainsNum<Schema> extends true ? {
  [K in keyof Schema as IsNum<Schema[K]> extends true ? K : never]?: number | bigint
} : TypeErr<'Can not perform a number operation on a schema with no numbers'>;

type ArrayUpdate<Schema> = {
  [K in keyof Schema as any[] extends Schema[K] ? K : never]?: PickArrayTypes<Schema[K]>
};

type CurrentDate<Schema> =  {
  [K in keyof Schema as Schema[K] extends Date ? K : never]?: boolean
};

type ContainsArr<Schema> = any[] extends Schema[keyof Schema] ? true : false;
type ContainsNum<Schema> = IsNum<Schema[keyof Schema]>;

type PickArrayTypes<Schema> = Extract<Schema, any[]> extends (infer E)[] ? E : unknown
