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

export { Db } from './db';
export * from './errors';

export type {
  VectorOptions,
  WithKeyspace,
  VectorizeServiceOptions,
  DefaultIdOptions,
  IndexingOptions,
} from './types/collections-common';

export type {
  CollectionOptions,
} from './types/collection-options';

export type {
  CreateCollectionOptions,
} from './types/create-collection';

export type {
  ListCollectionsOptions,
  FullCollectionInfo,
} from './types/list-collection';

export type {
  DropCollectionOptions,
} from './types/drop-collection';

export type {
  RunCommandOptions,
} from './types/command';

export type {
  CollectionSpawnOptions,
} from './types/spawn-collection';
