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

export * from './cursor.js';
export * from './events.js';
export * from './datatypes/object-id.js';
export * from './collections/index.js';
export * from './tables/index.js';
export * from './embedding-providers/index.js';
export * from './datatypes/index.js';
export type * from './commands/index.js';
export type * from './types/index.js';

export type { DataAPIDetailedErrorDescriptor, DataAPIErrorDescriptor } from './errors.js';
export { DataAPIResponseError, DataAPIHttpError, DataAPITimeoutError, CumulativeOperationError, DataAPIError, CollectionDeleteManyError, CollectionInsertManyError, TableInsertManyError, TooManyDocumentsToCountError, CollectionUpdateManyError } from './errors.js';
