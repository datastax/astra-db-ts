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

import { HTTPRequestInfo } from '@/src/api/types';

/**
 * Internal representation of timeout options, allowing a shorthand for a single call timeout manager via
 * `maxTimeMS`, with an explicit {@link TimeoutManager} being allowed to be passed if necessary, generally
 * for multi-call timeout management.
 *
 * @internal
 */
export type TimeoutOptions = {
  maxTimeMS?: number,
  timeoutManager?: never,
} | {
  timeoutManager: TimeoutManager,
  maxTimeMS?: never,
}

/**
 * Represents a function that creates a timeout error for a given request context.
 *
 * @example
 * ```typescript
 * const mkTimeoutError: MkTimeoutError = (info) => {
 *   return new DevOpsAPITimeoutError(info.url, timeout);
 * }
 * ```
 *
 * @internal
 */
export type MkTimeoutError = (ctx: HTTPRequestInfo) => Error;

/**
 * Tracks the remaining time before a timeout occurs. Can be used for both single and multi-call timeout management.
 *
 * The first call to `msRemaining` will start the timer.
 *
 * @internal
 */
export class TimeoutManager {
  private _deadline!: number;
  private _started: boolean;

  public readonly ms: number;

  constructor(ms: number, readonly mkTimeoutError: MkTimeoutError) {
    this.ms = ms || 2147483647;
    this._started = false;
  }

  get msRemaining() {
    if (!this._started) {
      this._started = true;
      this._deadline = Date.now() + this.ms;
      return this.ms
    }
    return this._deadline - Date.now();
  }
}
