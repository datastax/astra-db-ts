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

import type { Projection } from '@/src/data-api/types';

const test1: Projection = {
  'num1': 1,
  'sdjfklsdjflsd;afj': 0,
  'num2': true,
  'obj.str1': false,
  'obj.str2': { $slice: 1 },
  'sdff34uu9fu44329$9843f@90&@)#(0y92fsa': { $slice: [23, 34] },
};

const test2: Projection = {
  // @ts-expect-error - Invalid type
  'num1': 1n,
};
