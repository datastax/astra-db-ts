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

import { AdminSpawnOptions } from '@/src/devops/types';
import { validateOption } from '@/src/data-api/utils';

/**
 * @internal
 */
export function validateAdminOpts(opts: AdminSpawnOptions | undefined) {
  validateOption('adminOptions', opts, 'object', false, (opts) => {
    validateOption('adminOptions.monitorCommands', opts.monitorCommands, 'boolean');
    validateOption('adminOptions.endpointUrl', opts.endpointUrl, 'string');
  });
}
