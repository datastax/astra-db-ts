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

import { SomeDoc } from '@/src/client';
import { ProjectionOption, SortOption } from '@/src/client/types/common';

export interface FindOptions<Schema extends SomeDoc, GetSim extends boolean> {
  sort?: SortOption<Schema>;
  projection?: ProjectionOption<Schema>;
  limit?: number;
  skip?: number;
  includeSimilarity?: GetSim;
  batchSize?: number;
}

export interface InternalFindOptions {
  pagingState?: string;
  limit?: number;
  skip?: number;
  includeSimilarity?: boolean;
}

export interface InternalGetMoreCommand {
  find: {
    filter?: Record<string, unknown>;
    options?: InternalFindOptions;
    sort?: Record<string, unknown>;
    projection?: Record<string, unknown>;
  }
}

export const internalFindOptionsKeys = new Set(['limit', 'skip', 'pagingState', 'includeSimilarity']);
