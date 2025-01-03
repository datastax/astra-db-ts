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

/**
 * The caller information to send with requests, of the form `[name, version?]`, or an array of such.
 *
 * **Intended generally for integrations or frameworks that wrap the client.**
 *
 * Used to identify the client making requests to the server.
 *
 * It will be sent in the headers of the request as such:
 * ```
 * User-Agent: ...<name>/<version> astra-db-ts/<version>
 * ```
 *
 * If no caller information is provided, the client will simply be identified as `astra-db-ts/<version>`.
 *
 * **NB. If providing an array of callers, they should be ordered from most important to least important.**
 *
 * @public
 */
export type Caller = readonly [name: string, version?: string];
