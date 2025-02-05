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

import type { Sort } from '@/src/documents/index.js';

const test1: Sort = {
  'num1': 1,
  'nmsdufhklsdafjksdahf': -1,
};

const test2: Sort = {
  'num1': 1,
  $vector: [0.23, 0.38, 0.27, 0.91, 0.21],
};

const test3: Sort = {
  // @ts-expect-error - Must be 1 or -1
  'num1': 2,
};

const test4: Sort = {
  // @ts-expect-error - Must be 1 or -1
  'num1': 1n,
};

// TODO
// const test5: Sort = {
//   // @ts-expect-error - Must be a number[]
//   $vector: '[0.23, 0.38, 0.27, 0.91, 0.21]',
// };
//
// const test6: Sort = {
//   // @ts-expect-error - Must be a string
//   $vectorize: [0.23, 0.38, 0.27, 0.91, 0.21],
// };
