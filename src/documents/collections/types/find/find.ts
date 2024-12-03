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

import { GenericFindOptions } from '@/src/documents';
import { nullish } from '@/src/lib';

/**
 * Options for the `find` method.
 *
 * @field sort - The sort order to pick which document to return if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field limit - Max number of documents to return in the lifetime of the cursor.
 * @field skip - Number of documents to skip if using a sort.
 * @field includeSimilarity - If true, include the similarity score in the result via the `$similarity` field.
 *
 * @see Collection.find
 *
 * @public
 */
export type CollectionFindOptions<IncSim extends boolean | nullish = undefined> = GenericFindOptions<IncSim>;
