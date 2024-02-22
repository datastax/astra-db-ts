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

import { ProjectionOption, SortOption } from '@/src/collections/operations/find/find-common';

export interface FindOneCommand<Schema> {
  findOne: {
    filter: Record<string, any>;
    options?: FindOneOptions<Schema>;
    sort?: SortOption;
    projection?: ProjectionOption<Schema>;
  };
}

export interface FindOneOptions<Schema> {
  sort?: Record<string, 1 | -1>;
  projection?: ProjectionOption<Schema>;
  includeSimilarity?: boolean;
}

export const findOneOptionsKeys = new Set(['includeSimilarity', 'sort', 'projection']);
