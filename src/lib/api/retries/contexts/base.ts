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

import type { TimeoutDescriptor } from '@/src/lib/index.js';
import type { InternalRetryContext } from '@/src/lib/api/retries/contexts/internal.js';
import type { DataAPIRetryContext } from '@/src/lib/api/retries/contexts/data-api.js';
import type { DevOpsAPIRetryContext } from '@/src/lib/api/retries/contexts/devops-api.js';

export abstract class RetryContext {
  public declare abstract readonly permits: DataAPIRetryContext | DevOpsAPIRetryContext;

  public readonly retryCount: number;

  public readonly error: Error;

  public readonly isSafelyRetryable: boolean;

  public readonly timeout: Partial<TimeoutDescriptor>;

  public readonly duration: number;

  public readonly userData: Record<string, any>;

  public readonly requestId: string;

  protected constructor(ctx: InternalRetryContext, duration: number, error: Error) {
    this.retryCount = ctx.retryCount;
    this.isSafelyRetryable = ctx.isSafelyRetryable;
    this.timeout = ctx.timeout;
    this.userData = ctx.userData;
    this.duration = duration;
    this.error = error;
    this.requestId = ctx.requestId;
  }
}
