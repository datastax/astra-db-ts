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

import type { RetryAdapter } from '@/src/lib/api/retries/manager.js';
import type { DevOpsAPIRequestInfo } from '@/src/lib/api/clients/index.js';
import type { InternalRetryContext } from '@/src/lib/api/retries/contexts/internal.js';
import type { HierarchicalLogger } from '@/src/lib/index.js';
import type { AdminCommandEventMap } from '@/src/administration/index.js';
import { DevOpsAPITimeoutError } from '@/src/administration/index.js';
import { DevOpsAPIRetryContext } from '@/src/lib/api/retries/contexts/devops-api.js';

export class DevOpsAPIRetryAdapter implements RetryAdapter<DevOpsAPIRetryContext, DevOpsAPIRequestInfo> {
  public readonly policy = 'devOpsAPIPolicy';
  public readonly TimeoutError = DevOpsAPITimeoutError;

  public constructor(private readonly _logger: HierarchicalLogger<AdminCommandEventMap>) {}

  public mkEphemeralCtx(ctx: InternalRetryContext, duration: number, error: Error, req: DevOpsAPIRequestInfo): DevOpsAPIRetryContext {
    return new DevOpsAPIRetryContext(ctx, duration, error, req);
  }

  public emitRetryEvent(): void {
    // TODO
  }

  public emitRetryDeclinedEvent(): void {
    // TODO
  }
}
