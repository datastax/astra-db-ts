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
import { DataAPIResponseError } from '@/src/documents/index.js';
import type { BaseRequestMetadata } from '@/src/lib/api/clients/index.js';

/**
 * @internal
 */
export interface RetryAdapter<Ctx extends RetryContext, ReqMeta extends BaseRequestMetadata> {
  policy: Exclude<keyof RetryConfig, 'defaultPolicy'>,
  mkEphemeralCtx(ctx: InternalRetryContext, duration: number, error: Error, req: ReqMeta): Ctx,
  emitRetryEvent(ctx: Ctx, meta: ReqMeta): void,
  emitRetryDeclinedEvent(ctx: Ctx, meta: ReqMeta): void,
  TimeoutError: SomeConstructor,
}

/**
 * @internal
 */
export abstract class RetryManager<ReqMeta extends BaseRequestMetadata> {
  public static mk<Ctx extends RetryContext, ReqMeta extends BaseRequestMetadata>(isSafelyRetryable: boolean, opts: CommandOptions, adapter: RetryAdapter<Ctx, ReqMeta>, basePolicy: RetryConfig | undefined): RetryManager<ReqMeta> {
    if (opts.retry ?? basePolicy) {
      const policy = opts.retry?.[adapter.policy] ?? opts.retry?.defaultPolicy ?? basePolicy?.[adapter.policy] ?? basePolicy?.defaultPolicy;

      if (policy && !(policy as unknown instanceof RetryPolicy.Never)) {
        return new RetryingImpl(policy, opts.isSafelyRetryable ?? isSafelyRetryable, adapter);
      }
    }

    return PassthroughImpl;
  }

  public abstract run<T>(meta: ReqMeta, tm: TimeoutManager, fn: () => Promise<T>): Promise<T>;
}

/**
 * @internal
 */
class RetryingImpl<Ctx extends RetryContext, ReqMeta extends BaseRequestMetadata> extends RetryManager<ReqMeta> {
  private readonly _adapter: RetryAdapter<Ctx, ReqMeta>;

  private readonly _policy: RetryPolicy<Ctx>;

  private readonly _isSafelyRetryable: boolean;

  private readonly _retryDurationTracker = new RetryDurationTracker();

  constructor(policy: RetryPolicy<Ctx>, isSafelyRetryable: boolean, adapter: RetryAdapter<Ctx, ReqMeta>) {
    super();
    this._policy = policy;
    this._isSafelyRetryable = isSafelyRetryable;
    this._adapter = adapter;
  }

  public override async run<T>(metadata: ReqMeta, tm: TimeoutManager, fn: () => Promise<T>) {
    const baseCtx = new InternalRetryContext(this._isSafelyRetryable, metadata.timeout, metadata.requestId);

    while (true) {
      const ephemeralDurationTracker = this._retryDurationTracker.forRequest();

      try {
        return await fn();
      } catch (caught) {
        const ephemeralCtx = this._mkEphemeralCtx(caught, baseCtx, metadata);

        if (!this._shouldRetry(ephemeralCtx)) {
          this._emitRetryDeclined(ephemeralCtx, metadata);
          throw ephemeralCtx.error;
        }

        baseCtx.retryCount++;
        this._emitRetryAccepted(ephemeralCtx, metadata);

        const delay = this._policy.retryDelay(ephemeralCtx);

        if (delay) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (this._policy.shouldResetTimeout(ephemeralCtx)) {
          ephemeralDurationTracker.updateRetryDebt();
        }
      } finally {
        tm.retard(ephemeralDurationTracker.endAndConsumeDebt());
      }
    }
  }

  private _mkEphemeralCtx(error: unknown, baseCtx: InternalRetryContext, metadata: ReqMeta) {
    return this._adapter.mkEphemeralCtx(baseCtx, performance.now() - metadata.startTime, NonErrorError.asError(error), metadata);
  }

  private _shouldRetry(ephemeralCtx: Ctx) {
    return this._passesInitialRetryChecks(ephemeralCtx) && this._policy.shouldRetry(ephemeralCtx);
  }

  private _passesInitialRetryChecks(ephemeralCtx: Ctx) {
    if (ephemeralCtx.retryCount >= this._policy.maxRetries(ephemeralCtx)) {
      return false;
    }

    if (ephemeralCtx.error instanceof this._adapter.TimeoutError) {
      return false;
    }

    if (ephemeralCtx.isSafelyRetryable) {
      return !(ephemeralCtx.error instanceof DataAPIResponseError) || (ephemeralCtx.error as SomeDoc).canRetry === true; // TODO: Swap for actual Data API implementation once available
    } else {
      return ephemeralCtx.error instanceof DataAPIResponseError && (ephemeralCtx.error as SomeDoc).canRetry === true;
    }
  }

  private _emitRetryAccepted(ephemeralCtx: Ctx, metadata: ReqMeta) {
    this._policy.onRetry(ephemeralCtx);
    this._adapter.emitRetryEvent(ephemeralCtx, metadata);
  }

  private _emitRetryDeclined(ephemeralCtx: Ctx, metadata: ReqMeta) {
    this._policy.onRetryDeclined(ephemeralCtx);
    this._adapter.emitRetryDeclinedEvent(ephemeralCtx, metadata);
  }
}

class RetryDurationTracker {
  private _runningCount = 0;
  private _debtLastUpdated?: number;
  private _debt = 0;

  public forRequest() {
    this._runningCount++;

    if (this._debtLastUpdated === undefined) {
      this._debtLastUpdated = Date.now();
    }

    return {
      updateRetryDebt: () => {
        this._updateDebt(this._debt + (Date.now() - this._debtLastUpdated!));
      },
      endAndConsumeDebt: () => {
        this._runningCount--;
        const debt = this._debt;
        this._updateDebt(0);
        return debt;
      },
    };
  }

  private _updateDebt(debt: number) {
    this._debt = debt;

    if (this._runningCount) {
      this._debtLastUpdated = Date.now();
    } else {
      this._debtLastUpdated = undefined;
    }
  }
}

/**
 * @internal
 */
const PassthroughImpl = new class PassthroughImpl extends RetryManager<never> {
  public override run<T>(_: never, __: never, fn: () => Promise<T>) {
    return fn();
  }
}();
