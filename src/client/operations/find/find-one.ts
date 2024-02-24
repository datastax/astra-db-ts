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

import { ProjectionOption, SortOption } from '@/src/client/operations/find/find-common';
import { SomeDoc } from '@/src/client';

export interface FindOneCommand {
  findOne: {
    filter: Record<string, unknown>;
    options?: FindOneOptions<any, boolean>;
    sort?: SortOption<any>;
    projection?: ProjectionOption<any>;
  };
}

export interface FindOneOptions<Schema extends SomeDoc, GetSim extends boolean> {
  sort?: SortOption<Schema>;
  projection?: ProjectionOption<Schema>;
  includeSimilarity?: GetSim;
}

export const findOneOptionsKeys = new Set(['includeSimilarity', 'sort', 'projection']);
