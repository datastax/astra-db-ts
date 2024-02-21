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

export { Client, AstraDB } from './client';
export { Collection } from './collection';

export { InsertOneResult } from '@/src/collections/operations/insert/insert-one';
export { InsertManyOptions, InsertManyResult } from '@/src/collections/operations/insert/insert-many';
export { UpdateOneOptions, UpdateOneResult, } from '@/src/collections/operations/update/update-one';
export { UpdateManyOptions, UpdateManyResult } from '@/src/collections/operations/update/update-many';
export { DeleteOneOptions, DeleteOneResult } from '@/src/collections/operations/delete/delete-one';
export { DeleteManyResult } from '@/src/collections/operations/delete/delete-many';
export { FindOptions } from '@/src/collections/operations/find/find';
export { SortOption } from '@/src/collections/operations/find/find-common';
export { FindOneOptions } from '@/src/collections/operations/find/find-one';
export { FindOneAndDeleteOptions } from '@/src/collections/operations/find/find-one-delete';
export { FindOneAndUpdateOptions } from '@/src/collections/operations/find/find-one-update';
export { FindOneAndReplaceOptions } from '@/src/collections/operations/find/find-one-replace';
export { UpdateFilter } from '@/src/collections/operations/update-filter';
export { Filter } from '@/src/collections/operations/filter';

export { createAstraUri } from './utils';
