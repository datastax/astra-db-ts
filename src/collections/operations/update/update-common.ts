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

interface GuaranteedUpdateOptions<N> {
  acknowledged: true;
  matchedCount: N;
  modifiedCount: N;
}

interface UpsertedUpdateOptions {
  upsertedId: string;
  upsertedCount: 1;
}

interface NoUpsertUpdateOptions {
  upsertedCount?: never;
  upsertedId?: never;
}

export type InternalUpdateResult<N> =
  | (GuaranteedUpdateOptions<N> & UpsertedUpdateOptions)
  | (GuaranteedUpdateOptions<N> & NoUpsertUpdateOptions)

// interface Schema {
//   num: number,
//   obj: {
//     str: string,
//     obj: {
//       num: number,
//       any: AnyDict,
//     },
//   },
//   arr: string[],
// }
//
// const a: UpdateFilter<Schema> = {
//   $set: {
//     num: 3,
//     'obj.str': 'str',
//   },
//   $unset: {
//     'obj.obj.any.abc': '',
//   },
//   $inc: {
//     num: 1,
//     'obj.obj.any.abc': 3,
//     'obj.obj.num': 3,
//   },
//   $push: {
//     arr: 'str',
//     'obj.obj.any.abc': 3,
//   },
//   $pop: {
//     'obj.obj.any.abc': 3,
//     arr: 1,
//   },
// }
