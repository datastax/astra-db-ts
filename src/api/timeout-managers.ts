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

export type TimeoutOptions = {
  maxTimeMS?: number,
  timeoutManager?: never,
} | {
  timeoutManager: TimeoutManager,
  maxTimeMS?: never,
}

export type MkTimeoutError = (ctx: InternalHTTPRequestInfo) => Error;

export interface TimeoutManager {
  msRemaining: number,
  mkTimeoutError: MkTimeoutError,
}

export class SingleCallTimeoutManager implements TimeoutManager {
  public readonly msRemaining: number;

  constructor(maxMs: number, readonly mkTimeoutError: MkTimeoutError) {
    this.msRemaining = maxMs || Infinity;
  }
}

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
