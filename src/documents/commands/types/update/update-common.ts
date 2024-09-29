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

export interface GuaranteedUpdateOptions<N extends number> {
  matchedCount: N,
  modifiedCount: N,
}

export interface UpsertedUpdateOptions<ID> {
  upsertedId: ID;
  upsertedCount: 1;
}


export interface NoUpsertUpdateOptions {
  upsertedCount: 0;
  upsertedId?: never;
}

export type InternalUpdateResult<ID, N extends number> =
  | (GuaranteedUpdateOptions<N> & UpsertedUpdateOptions<ID>)
  | (GuaranteedUpdateOptions<N> & NoUpsertUpdateOptions)
