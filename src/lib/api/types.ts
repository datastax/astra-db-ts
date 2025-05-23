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

import type { DataAPIErrorDescriptor, DataAPIWarningDescriptor } from '@/src/documents/errors.js';

/**
 * Unstable backdoor to some class's internal HTTP client. No guarantees are made about this type.
 *
 * @public
 */
export type OpaqueHttpClient = any;

/**
 * The response format of a 2XX-status Data API call
 *
 * @public
 */
export interface RawDataAPIResponse {
  /**
   * A response data holding documents that were returned as the result of a command.
   */
  readonly status?: Record<string, any>,
  /**
   * Status objects, generally describe the side effects of commands, such as the number of updated or inserted documents.
   */
  readonly errors?: DataAPIErrorDescriptor[],
  /**
   * Array of objects or null (Error)
   */
  readonly data?: Record<string, any>,
  /**
   * Array of objects or null (Error)
   */
  readonly warnings?: DataAPIWarningDescriptor[],
}

/**
 * Represents some, _any_, constructor (e.g. `Error`, `Map`, or `MyCustomClass`).
 *
 * @public
 */
export type SomeConstructor = abstract new (...args: any[]) => any;
