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

import type { RetryContext } from '@/src/lib/api/retries/contexts/base.js';
import type { CommandOptions, SomeConstructor } from '@/src/lib/index.js';
import { InternalRetryContext } from '@/src/lib/api/retries/contexts/internal.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import type { RetryConfig } from '@/src/lib/api/retries/config.js';
import { RetryPolicy } from '@/src/lib/api/retries/policy.js';
import { NonErrorError } from '@/src/lib/errors.js';
import type { SomeDoc } from '@/src/documents/index.js';
import { DataAPIError } from '@/src/documents/index.js';

export interface RetryAdapter<Ctx extends RetryContext, ReqInfo> {
  policy: Exclude<keyof RetryConfig, 'defaultPolicy'>,
  mkEphemeralCtx(ctx: InternalRetryContext, duration: number, error: Error, req: ReqInfo): Ctx,
  emitRetryEvent(ctx: Ctx, info: ReqInfo): void,
  emitRetryDeclinedEvent(ctx: Ctx, info: ReqInfo): void,
  TimeoutError: SomeConstructor,
}

export abstract class RetryManager<ReqInfo> {
  public static mk<Ctx extends RetryContext, ReqInfo>(isSafelyRetryable: boolean, opts: CommandOptions, adapter: RetryAdapter<Ctx, ReqInfo>, basePolicy: RetryConfig | undefined): RetryManager<ReqInfo> {
    if (opts.retry ?? basePolicy) {
      const policy = opts.retry?.[adapter.policy] ?? opts.retry?.defaultPolicy ?? basePolicy?.[adapter.policy] ?? basePolicy?.defaultPolicy;

      if (policy && !(policy instanceof RetryPolicy.Never)) {
        return new RetryingImpl<Ctx, ReqInfo>(policy, opts.isSafelyRetryable ?? isSafelyRetryable, adapter);
      }
    }

    return PassthroughImpl;
  }

  public abstract run<T>(info: ReqInfo, started: number, reqId: string, tm: TimeoutManager, fn: () => Promise<T>): Promise<T>;
}

class RetryingImpl<Ctx extends RetryContext, ReqInfo> extends RetryManager<ReqInfo> {
  private readonly _adapter: RetryAdapter<Ctx, ReqInfo>;

  private readonly _isSafelyRetryable: boolean;

  public readonly _policy: RetryPolicy<Ctx>;

  constructor(policy: RetryPolicy<Ctx>, isSafelyRetryable: boolean, adapter: RetryAdapter<Ctx, ReqInfo>) {
    super();
    this._policy = policy;
    this._isSafelyRetryable = isSafelyRetryable;
    this._adapter = adapter;
  }

  public override run<T>(info: ReqInfo, started: number, reqId: string, tm: TimeoutManager, fn: () => Promise<T>) {
    const baseCtx = new InternalRetryContext(this._isSafelyRetryable, tm.initial(), reqId);

    while (true) {
      try {
        return fn();
      } catch (caught) {
        const error = NonErrorError.asError(caught);

        const ephemeralCtx = this._adapter.mkEphemeralCtx(baseCtx, performance.now() - started, error, info);

        if (!this._passesInitialRetryChecks(ephemeralCtx) || !this._policy.shouldRetry(ephemeralCtx)) {
          this._policy.onRetryDeclined(ephemeralCtx);
          this._adapter.emitRetryDeclinedEvent(ephemeralCtx, info);
          throw error;
        }

        if (this._policy.shouldResetTimeout(ephemeralCtx)) {
          tm.reset();
        }

        baseCtx.retryCount++;
        this._policy.onRetry(ephemeralCtx);
        this._adapter.emitRetryEvent(ephemeralCtx, info);
      }
    }
  }

  private _passesInitialRetryChecks(ephemeralCtx: Ctx) {
    if (ephemeralCtx.retryCount >= this._policy.maxRetries(ephemeralCtx)) {
      return false;
    }

    if (ephemeralCtx.error instanceof this._adapter.TimeoutError) {
      return false;
    }

    if (ephemeralCtx.isSafelyRetryable) {
      return !(ephemeralCtx.error instanceof DataAPIError) || (ephemeralCtx.error as SomeDoc).canRetry === true; // TODO: Swap for actual Data API implementation once available
    } else {
      return ephemeralCtx.error instanceof DataAPIError && (ephemeralCtx.error as SomeDoc).canRetry === true;
    }
  }
}

const PassthroughImpl = new class PassthroughImpl extends RetryManager<never> {
  public override run<T>(_: never, __: never, ___: never, ____: never, fn: () => Promise<T>) {
    return fn();
  }
}();
