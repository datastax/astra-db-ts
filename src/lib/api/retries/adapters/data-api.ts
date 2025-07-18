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
import { DataAPIRetryContext } from '@/src/lib/api/retries/contexts/data-api.js';
import type { DataAPIRequestMetadata } from '@/src/lib/api/clients/index.js';
import type { InternalRetryContext } from '@/src/lib/api/retries/contexts/internal.js';
import { type CommandEventMap, DataAPITimeoutError } from '@/src/documents/index.js';
import type { HierarchicalLogger } from '@/src/lib/index.js';

/**
 * @internal
 */
export class DataAPIRetryAdapter implements RetryAdapter<DataAPIRetryContext, DataAPIRequestMetadata> {
  public readonly policy = 'dataAPIPolicy';
  public readonly TimeoutError = DataAPITimeoutError;

  public constructor(private readonly _logger: HierarchicalLogger<CommandEventMap>) {}

  public mkEphemeralCtx(ctx: InternalRetryContext, duration: number, error: Error, req: DataAPIRequestMetadata): DataAPIRetryContext {
    return new DataAPIRetryContext(ctx, duration, error, req);
  }

  public emitRetryEvent(): void {
    // TODO
  }

  public emitRetryDeclinedEvent(): void {
    // TODO
  }
}
