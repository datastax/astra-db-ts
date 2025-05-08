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

import type { AbstractCursor, CursorState} from '@/src/documents/index.js';
import { DataAPIError } from '@/src/documents/errors.js';

/**
 * ##### Overview
 *
 * A generic exception that may be thrown whenever something non-request-related goes wrong with a cursor.
 *
 * Errors like {@link DataAPIResponseError}s and {@link DataAPITimeoutError}s which occur during a request of the cursor will still be thrown directly.
 *
 * This error is intended for errors more-so related to validation & the cursor's lifecycle.
 *
 * @see AbstractCursor
 * @see FindCursor
 * @see FindAndRerankCursor
 *
 * @public
 */
export class CursorError extends DataAPIError {
  /**
   * The underlying cursor which caused this error.
   */
  public readonly cursor: AbstractCursor<unknown>;

  /**
   * The status of the cursor when the error occurred.
   */
  public readonly state: CursorState;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  constructor(message: string, cursor: AbstractCursor<unknown>) {
    super(message);
    this.name = 'CursorError';
    this.cursor = cursor;
    this.state = cursor.state;
  }
}
