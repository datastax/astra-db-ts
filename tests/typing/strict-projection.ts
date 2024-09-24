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

import type { StrictProjection } from '@/src/documents/collections/types';
import { ConvolutedSchema2, Schema } from '@/tests/typing/prelude';

const test1: StrictProjection<Schema> = {
  'num1': 1,
  'num2': true,
  'obj.str1': false,
  'obj.obj.any.str': 0,
  '_id': 1,
};

const test2: StrictProjection<Schema> = {
  // @ts-expect-error - Invalid type
  'num1': 1n,
};

const test3: StrictProjection<Schema> = {
  // @ts-expect-error - Invalid field
  'sdjfklsdjflsd;afj': 0,
};

const test4: StrictProjection<Schema> = {
  // @ts-expect-error - Can't slice a string
  'obj.str2': { $slice: 1 },
};

const test5: StrictProjection<ConvolutedSchema2> = {
  numOrArray: { $slice: [1, 3] },
};

const test6: StrictProjection<ConvolutedSchema2> = {
  numOrArray: { $slice: [1, 3] },
  '*': 1,
};

const test7: StrictProjection<ConvolutedSchema2> = {
  '*': false,
};
