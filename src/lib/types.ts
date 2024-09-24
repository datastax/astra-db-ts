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

import { DataAPIEnvironments } from '@/src/lib/constants';

/**
 * Represents options related to timeouts. Note that this means "the max time the client will wait for a response
 * from the server"—**an operation timing out does not necessarily mean the operation failed on the server**.
 *
 * On paginated operations, the timeout applies across all network requests. For example, if you set a timeout of 5
 * seconds and the operation requires 3 network requests, each request must complete in less than 5 seconds total.
 *
 * @public
 */
export interface WithTimeout {
  /**
   * The maximum time to wait for a response from the server, in milliseconds.
   */
  maxTimeMS?: number;
}

/**
 * Shorthand type to represent some nullish value. Generally meant for internal use.
 *
 * @public
 */
export type nullish = null | undefined;

/**
 * All the available Data API backends the Typescript client recognizes.
 *
 * If using a non-Astra database as the backend, the `environment` option should be set in the `DataAPIClient` options,
 * as well as in the `db.admin()` options.
 *
 * @public
 */
export type DataAPIEnvironment = typeof DataAPIEnvironments[number];

/**
 * @internal
 */
export type Ref<T> = { ref: T }
