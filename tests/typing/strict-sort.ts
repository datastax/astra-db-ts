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

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { Sort, StrictSort } from '@/src/documents/collections/types';
import { Schema } from '@/tests/typing/prelude';

const test1 = {
  'num1': 1,
  'num2': -1,
  'obj.obj.any.xyz': 1,
} satisfies StrictSort<Schema>;

const test2 = {
  'obj.str2': 1,
  $vector: [0.23, 0.38, 0.27, 0.91, 0.21],
} satisfies StrictSort<Schema>;

const test3 = {
  // @ts-expect-error - Must be 1 or -1
  'num1': 2,
} satisfies StrictSort<Schema>;

const test4 = {
  // @ts-expect-error - Must be 1 or -1
  'num1': 1n,
} satisfies StrictSort<Schema>;

const test5 = {
  // @ts-expect-error - Must be a number[]
  $vector: '[0.23, 0.38, 0.27, 0.91, 0.21]',
} satisfies StrictSort<Schema>;

const test6 = {
  // @ts-expect-error - Must be a string
  $vectorize: [0.23, 0.38, 0.27, 0.91, 0.21],
} satisfies StrictSort<Schema>;

const test7 = {
  // @ts-expect-error - Invalid property
  'num3': 1,
} satisfies StrictSort<Schema>;
