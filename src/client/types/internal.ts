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

import type { AdminSpawnOptions, DataAPIClientEvents, DataAPILoggingOutput, DbSpawnOptions } from '@/src/client';
import type { DataAPIEnvironment, TokenProvider } from '@/src/lib';
import type TypedEmitter from 'typed-emitter';
import type { FetchCtx } from '@/src/lib/api/fetch/types';

/**
 * @internal
 */
export type InternalLoggingConfig = Record<keyof DataAPIClientEvents, Record<DataAPILoggingOutput, boolean>>

/**
 * @internal
 */
export interface InternalRootClientOpts {
  logging: InternalLoggingConfig,
  environment: DataAPIEnvironment,
  emitter: TypedEmitter<DataAPIClientEvents>,
  fetchCtx: FetchCtx,
  userAgent: string,
  dbOptions: Omit<DbSpawnOptions, 'token'> & {
    token: TokenProvider,
    monitorCommands: boolean,
  },
  adminOptions: Omit<AdminSpawnOptions, 'adminToken'> & {
    adminToken: TokenProvider,
    monitorCommands: boolean,
  },
}