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
import type { DataAPIRequestMetadata } from '@/src/lib/api/clients/index.js';
import type { CommandEventTarget } from '@/src/documents/index.js';

export class DataAPIRetryContext extends RetryContext {
  public declare readonly permits: this;

  public readonly target: CommandEventTarget;

  public readonly command: Record<string, any>;

  public readonly commandName: string;

  /**
   * Should not be instantiated by the user directly.
   *
   * @internal
   */
  public constructor(ctx: InternalRetryContext, duration: number, error: Error, req: DataAPIRequestMetadata) {
    super(ctx, duration, error);
    this.target = req.target;
    this.command = req.command;
    this.commandName = Object.keys(req.command)[0];
  }
}
