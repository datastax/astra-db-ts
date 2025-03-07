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

/**
 * Options for executing some arbitrary command.
 *
 * @see Db.command
 *
 * @public
 */
export interface RunCommandOptions extends WithTimeout<'generalMethodTimeoutMs'> {
  /**
   * The collection to run the command on.
   *
   * If not provided, the command will run on the keyspace, or directly on the database if `keyspace` is `null`.
   *
   * Only one of this or {@link RunCommandOptions.table} should be provided.
   */
  collection?: string,
  /**
   * The collection to run the command on.
   *
   * If not provided, the command will run on the keyspace, or directly on the database if `keyspace` is `null`.
   *
   * Only one of this or {@link RunCommandOptions.table} should be provided.
   */
  table?: string,
  /**
   * Overrides the keyspace to run the command on.
   *
   * If undefined/not provided, the command will run on the db's default working keyspace.
   *
   * **This may be set to `null` to run the command directly on the database.**
   */
  keyspace?: string | null,
  /**
   * A small string to add to the log message for this command (only if you're printing to `stdout`/`stderr` using {@link LoggingConfig}).
   */
  extraLogInfo?: Record<string, unknown>,
}
