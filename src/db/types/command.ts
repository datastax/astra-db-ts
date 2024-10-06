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

import { WithTimeout } from '@/src/lib';

/**
 * Options for executing some arbitrary command.
 *
 * @field collections - The collections to run the command on. If not provided, the command is run on the database.
 * @field keyspace - Overrides the keyspace to run the command in. If not provided, the default keyspace is used.
 *
 * @see Db.command
 *
 * @public
 */
export interface RunCommandOptions extends WithTimeout {
  /**
   * The collections to run the command on. If not provided, the command is run on the database.
   */
  collection?: string,
  table?: string,
  /**
   * The keyspace to use for the db operation.
   */
  keyspace?: string | null,
}
