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

import type { WithTimeout } from '@/src/lib/index.js';
import type { WithKeyspace } from '@/src/db/index.js';

/**
 * The options for dropping a table (via {@link Db.dropTable}).
 *
 * @public
 */
export interface DropTableOptions extends WithTimeout<'tableAdminTimeoutMs'>, WithKeyspace {
  /**
   * If `true`, no error will be thrown if the table does not exist.
   *
   * Defaults to `false`.
   */
  ifExists?: boolean;
}
