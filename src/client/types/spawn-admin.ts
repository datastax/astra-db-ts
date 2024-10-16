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

import type { TokenProvider } from '@/src/lib';
import { DataAPILoggingConfig } from '@/src/client';

export type DefaultAdminSpawnOptions = Omit<AdminSpawnOptions, 'logging'>;

/**
 * The options available spawning a new {@link AstraAdmin} instance.
 *
 * **Note that this is only available when using Astra as the underlying database.**
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface AdminSpawnOptions {
  logging?: DataAPILoggingConfig,
  /**
   * The access token for the DevOps API, typically of the format `'AstraCS:...'`.
   *
   * If never provided, this will default to the token provided when creating the {@link DataAPIClient}.
   *
   * May be useful for if you want to use a stronger token for the DevOps API than the Data API.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('weak-token');
   *
   * // Using 'weak-token' as the token
   * const db = client.db();
   *
   * // Using 'strong-token' instead of 'weak-token'
   * const admin = client.admin({ adminToken: 'strong-token' });
   * ```
   */
  adminToken?: string | TokenProvider | null,
  /**
   * The base URL for the devops API, which is typically always going to be the following:
   * ```
   * https://api.astra.datastax.com/v2
   * ```
   */
  endpointUrl?: string,
}
