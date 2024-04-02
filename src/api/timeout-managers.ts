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

import { InternalHTTPRequestInfo } from '@/src/api/types';

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
 *   return new DevopsApiTimeout(info.url, timeout);
 * }
 * ```
 *
 * @internal
 */
export type MkTimeoutError = (ctx: InternalHTTPRequestInfo) => Error;

/**
 * Represents a timeout manager, which is responsible for tracking the remaining time before a timeout occurs.
 *
 * See {@link SingleCallTimeoutManager} and {@link MultiCallTimeoutManager} for concrete implementations.
 *
 * @internal
 */
export interface TimeoutManager {
  /**
   * The remaining time before a timeout occurs, in milliseconds. May return `Infinity`, which
   * the underlying http request strategies should interpret as no timeout.
   *
   * However, the implementing TimeoutManager classes should accept `0` to also indicate no timeout,
   * just translating it to `Infinity` for the purposes of the `msRemaining` getter, so it's easier to
   * reason about.
   */
  msRemaining: number,
  /**
   * A function that creates a timeout error for the given request context ({@link InternalHTTPRequestInfo}).
   */
  mkTimeoutError: MkTimeoutError,
}

/**
 * A basic timeout manager that only holds a fixed timeout value, intended for, of course, single-request operations.
 *
 * @internal
 */
export class SingleCallTimeoutManager implements TimeoutManager {
  public readonly msRemaining: number;

  constructor(maxMs: number, readonly mkTimeoutError: MkTimeoutError) {
    this.msRemaining = maxMs || Infinity;
  }
}

/**
 * A more complex timeout manager that tracks the remaining time for multiple calls, starting from the first call.
 * This is useful for scenarios where multiple calls are made in sequence, and the timeout should be shared among them,
 * e.g. {@link Collection.insertMany}.
 *
 * @internal
 */
export class MultiCallTimeoutManager implements TimeoutManager {
  private _deadline!: number;
  private _started: boolean;

  constructor(maxMs: number, readonly mkTimeoutError: MkTimeoutError) {
    this._deadline = maxMs || Infinity;
    this._started = false;
  }

  get msRemaining() {
    if (!this._started) {
      this._started = true;
      this._deadline = Date.now() + this._deadline;
    }
    return this._deadline - Date.now();
  }
}
