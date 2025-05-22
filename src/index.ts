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

export * from './client/index.js';
export * from './db/index.js';
export * from './documents/index.js';
export * from './administration/index.js';
export * from './lib/index.js';
export * from './version.js';
export { BigNumber } from 'bignumber.js';

import { RequestId } from '@/src/lib/api/clients/utils/request-id.js';
import { RetryManager } from '@/src/lib/api/retries/manager.js';
import { DataAPIRetryAdapter } from '@/src/lib/api/retries/adapters/data-api.js';
import { RetryPolicy } from '@/src/lib/api/retries/policy.js';
import { DataAPIClient } from '@/src/client/index.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { HTTPRequestInfo } from '@/src/lib/api/clients/index.js';

const rm = RetryManager.mk(true, {}, new DataAPIRetryAdapter(new DataAPIClient()), {
  defaultPolicy: new class extends RetryPolicy.Default {
    maxRetries = () => 10;
    shouldResetTimeout = () => true;
  },
});

const dummyMd = {
  startTime: 0,
  timeout: {},
  target: null!,
  requestId: new RequestId(),
  extra: {},
  command: {},
};

const dummyTm = new Timeouts({ mkTimeoutError: (info: HTTPRequestInfo) => new Error(JSON.stringify(info)) }, Timeouts.Default)
  .single('generalMethodTimeoutMs', {});

let i = 0;

await rm.run(dummyMd, dummyTm, async () => {
  await new Promise(resolve => setTimeout(resolve, 500));

  if (i < 5) {
    throw new Error(`${i++}`);
  }

  return Promise.resolve(4);
});
