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

export type IsNum<T> = number extends T ? true : bigint extends T ? true : false

type WithId<T> = Omit<T, '_id'> & { _id: string }
type WithSim<T, GetSim extends boolean> = GetSim extends true ? Omit<T, '$similarity'> & { $similarity: number } : T

export type FoundDoc<Doc, GetSim extends boolean> = WithSim<WithId<Doc>, GetSim>

export type MaybeId<Doc> = Omit<Doc, '_id'> & { _id?: string }
