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

/**
 * All the available Data API backends the Typescript client recognizes.
 *
 * If using a non-Astra database as the backend, the `environment` option should be set in the `DataAPIClient` options,
 * as well as in the `db.admin()` options.
 *
 * @public
 */
export const DataAPIEnvironments = <const>['astra', 'dse', 'hcd', 'cassandra', 'other'];

export const $CustomInspect = Symbol.for('nodejs.util.inspect.custom');
