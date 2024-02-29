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

export { Client } from './client';
export { Collection } from './collection';

export { InsertOneResult } from '@/src/client/types/insert/insert-one';
export { InsertManyOptions, InsertManyResult } from '@/src/client/types/insert/insert-many';
export { UpdateOneOptions, UpdateOneResult, } from '@/src/client/types/update/update-one';
export { UpdateManyOptions, UpdateManyResult } from '@/src/client/types/update/update-many';
export { DeleteOneOptions, DeleteOneResult } from '@/src/client/types/delete/delete-one';
export { DeleteManyResult } from '@/src/client/types/delete/delete-many';
export { FindOptions } from '@/src/client/types/find/find';
export { SortOption, ProjectionOption } from '@/src/client/types/find/find-common';
export { FindOneOptions } from '@/src/client/types/find/find-one';
export { FindOneAndDeleteOptions } from '@/src/client/types/find/find-one-delete';
export { FindOneAndUpdateOptions } from '@/src/client/types/find/find-one-update';
export { FindOneAndReplaceOptions } from '@/src/client/types/find/find-one-replace';
export { UpdateFilter } from '@/src/client/types/update-filter';
export { Filter } from '@/src/client/types/filter';
export { VectorDoc, SomeDoc } from '@/src/client/document';

export { createAstraUri } from './utils';
export { AstraDB } from '@/src/client/astra';
