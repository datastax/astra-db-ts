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

import type { RetryPolicy } from '@/src/lib/api/retries/policy.js';
import type { RetryContext } from '@/src/lib/api/retries/contexts/base.js';
import type { DataAPIRetryContext } from '@/src/lib/api/retries/contexts/data-api.js';
import type { DevOpsAPIRetryContext } from '@/src/lib/api/retries/contexts/devops-api.js';

export type RetryConfig = ExplicitRetryConfig | RetryPolicy<RetryContext>;

export interface ExplicitRetryConfig {
  defaultPolicy?: RetryPolicy<RetryContext>,
  dataAPIPolicy?: RetryPolicy<DataAPIRetryContext>,
  devOpsAPIPolicy?: RetryPolicy<DevOpsAPIRetryContext>,
}
