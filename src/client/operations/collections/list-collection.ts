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

import { CreateCollectionOptions } from '@/src/client/operations/collections/create-collection';
import { SomeDoc } from '@/src/client';

export interface ListCollectionsCommand {
  findCollections: {
    options: {
      explain: boolean,
    }
  }
}

// Is 'nameOnly' instead of 'explain' to be more Mongo-esque. May change in the future.
export interface ListCollectionsOptions<NameOnly extends boolean> {
  nameOnly?: NameOnly,
}

export type CollectionInfo<NameOnly extends boolean> = NameOnly extends true
  ? Pick<FullCollectionInfo, 'name'>
  : FullCollectionInfo;

interface FullCollectionInfo {
  name: string,
  options: CreateCollectionOptions<SomeDoc>,
}

export const listCollectionOptionsKeys = new Set(['explain']);
