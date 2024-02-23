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

import { InternalDeleteResult } from '@/src/collections/operations/delete/delete-common';
import { SortOption } from '@/src/collections';

export interface DeleteOneCommand {
  deleteOne: {
    filter: Record<string, unknown>;
    sort?: SortOption<any>;
  };
}

export interface DeleteOneOptions {
  sort?: Record<string, 1 | -1>;
}

export type DeleteOneResult = InternalDeleteResult<0 | 1>;
