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

import { GenericUpdateManyOptions, GenericUpdateResult, KeyOf, SomeRow } from '@/src/documents';

/**
 Options for an `updateMany` command on a table.
 *
 * @field upsert - If true, perform an insert if no rows match the filter.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Table.updateMany
 *
 * @public
 */
export type TableUpdateManyOptions = GenericUpdateManyOptions;

export type TableUpdateManyResult<Schema extends SomeRow> = GenericUpdateResult<KeyOf<Schema>, number>;
