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

import { RetryContext } from '@/src/lib/api/retries/contexts/base.js';
import type { InternalRetryContext } from '@/src/lib/api/retries/contexts/internal.js';
import type { DevOpsAPIRequestInfo, HttpMethodStrings } from '@/src/lib/api/clients/index.js';
import { EqualityProof } from '@/src/lib/utils.js';

export class DevOpsAPIRetryContext extends RetryContext {
  public declare readonly permits: this;

  public readonly method: 'GET' | 'POST' | 'DELETE';

  public readonly methodName: string;

  public readonly path: string;

  public constructor(ctx: InternalRetryContext, duration: number, error: Error, info: DevOpsAPIRequestInfo) {
    super(ctx, duration, error);
    this.method = info.method;
    this.methodName = info.methodName;
    this.path = info.path;
  }
}

// ensures that `method` is correctly typed without actually exposing `HttpMethodStrings`
void EqualityProof<DevOpsAPIRetryContext['method'], HttpMethodStrings, true>;
