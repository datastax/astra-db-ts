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

import { AstraAdminBlockingOptions } from '@/src/administration/types';
import { WithTimeout } from '@/src/lib';

/**
 * Represents the options for dropping a database (i.e. blocking options + timeout options).
 *
 * @public
 */
export type DropAstraDatabaseOptions = AstraAdminBlockingOptions & WithTimeout<'databaseAdminTimeoutMs'>;
