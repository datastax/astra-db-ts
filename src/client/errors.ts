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
    super('Error loading the fetch-h2 client for the DataAPIClient... please check the "Non-standard environment support" section of https://github.com/datastax/astra-db-ts for more information.');
    this.rootCause = rootCause;
    this.name = 'FailedToLoadDefaultClientError';
  }
}

/**
 * ##### Overview
 *
 * Error thrown when the Data API response is not as expected. Should never be thrown in normal operation.
 *
 * ##### Possible causes
 *
 * 1. A `Collection` was used on a table, or vice versa.
 *
 * 2. New Data API changes occurred that are not yet supported by the client.
 *
 * 3. There is a bug in the Data API or the client.
 *
 * ##### Possible solutions
 *
 * For #1, ensure that you're using the right `Table` or `Collection` class.
 *
 * If #2 or #3, upgrade your client, and/or open an issue on the [`astra-db-ts` GitHub repository](https://github.com/datastax/astra-db-ts/issues).
 *  - If you open an issue, please include the full error message and any relevant context.
 *  - Please do not hesitate to do so, as there is likely a bug somewhere.
 *
 * @public
 */
export class UnexpectedDataAPIResponseError extends Error {
  /**
   * The response that was unexpected.
   */
  public readonly rawDataAPIResponse?: unknown;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(message: string, rawDataAPIResponse: unknown) {
    try {
      super(`${message}\n\nRaw Data API response: ${JSON.stringify(rawDataAPIResponse)}`);
    } catch (_) {
      super(`${message}\n\nRaw Data API response: ${rawDataAPIResponse}`);
    }
    this.rawDataAPIResponse = rawDataAPIResponse;
    this.name = 'UnexpectedDataAPIResponseError';
  }

  public static require<T>(val: T | null | undefined, message: string, rawDataAPIResponse?: unknown): T {
    if (val === null || val === undefined) {
      throw new UnexpectedDataAPIResponseError(message, rawDataAPIResponse);
    }
    return val;
  }
}
