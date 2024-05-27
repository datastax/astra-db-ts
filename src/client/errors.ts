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
// noinspection DuplicatedCode

/**
 * Error thrown when the default fetch-h2 client fails to load.
 *
 * @public
 */
export class FailedToLoadDefaultClientError extends Error {
  /**
   * Root error that caused the failure to load the default client.
   */
  public readonly rootCause: Error;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(rootCause: Error) {
    super('Error loading the fetch-h2 client for the DataAPIClient... please check the "Non-standard runtime support" section of https://github.com/datastax/astra-db-ts for more information.');
    this.rootCause = rootCause;
  }
}
