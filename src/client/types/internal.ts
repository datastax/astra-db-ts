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

import type { DataAPIClientEventMap, DataAPIEnvironment, DataAPILoggingOutput } from '@/src/lib';
import type TypedEmitter from 'typed-emitter';
import type { FetchCtx } from '@/src/lib/api/fetch/types';
import { ParsedDbOpts } from '@/src/client/opts-handlers/db-opts-handler';
import { ParsedAdminOpts } from '@/src/client/opts-handlers/admin-opts-handler';

/**
 * @internal
 */
export type InternalLoggingOutputsMap = Readonly<Record<keyof DataAPIClientEventMap, Readonly<Record<DataAPILoggingOutput, boolean>> | undefined>>

/**
 * @internal
 */
export interface InternalRootClientOpts {
  environment: DataAPIEnvironment,
  emitter: TypedEmitter<DataAPIClientEventMap>,
  fetchCtx: FetchCtx,
  userAgent: string,
  dbOptions: ParsedDbOpts,
  adminOptions: ParsedAdminOpts,
}
