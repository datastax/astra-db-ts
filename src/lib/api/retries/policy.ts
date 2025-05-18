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

import { asMut } from '@/src/lib/utils.js';
import type { RetryContext } from '@/src/lib/api/retries/contexts/base.js';

export abstract class RetryPolicy<Ctx extends RetryContext> {
  public static readonly Default: typeof RetryPolicy<RetryContext>;
  public static readonly Never: typeof RetryPolicy<RetryContext>;

  public abstract maxRetries(ctx: Ctx): number;

  public abstract retryDelay(ctx: Ctx): number;

  public shouldRetry(_: Ctx): boolean {
    return true;
  }

  public shouldResetTimeout(_: Ctx): boolean {
    return false;
  }

  public onRetry(_: Ctx): void {}

  public onRetryDeclined(_: Ctx): void {}
}

/**
 * @internal
 */
class DefaultRetryPolicy extends RetryPolicy<RetryContext> {
  public maxRetries(): number {
    return 3;
  }

  public retryDelay(): number {
    return 1000;
  }
}

/**
 * @internal
 */
class NeverRetryPolicy extends RetryPolicy<RetryContext> {
  public maxRetries(): number {
    return 0;
  }

  public retryDelay(): number {
    return 0;
  }
}

asMut(DefaultRetryPolicy).Default = DefaultRetryPolicy;
asMut(DefaultRetryPolicy).Never = NeverRetryPolicy;
