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

import { SortOption } from '@/src/client/types/find/find-common';
import { SomeDoc } from '@/src/client';

export interface FindOneAndUpdateCommand {
  findOneAndUpdate: {
    filter?: Record<string, unknown>;
    update?: Record<string, any>;
    options?: FindOneAndUpdateOptions<any>;
    sort?: SortOption<any>;
  };
}

export interface FindOneAndUpdateOptions<Schema extends SomeDoc> {
  upsert?: boolean;
  returnDocument?: "before" | "after";
  sort?: SortOption<Schema>;
}

export const findOneAndUpdateOptionsKeys = new Set(['upsert', 'returnDocument', 'sort']);
