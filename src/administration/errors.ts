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

import type { FetcherResponseInfo} from '@/src/lib/api/index.js';
import { type TimeoutDescriptor } from '@/src/lib/api/index.js';
import type { SomeDoc } from '@/src/documents/index.js';
import type { HTTPRequestInfo } from '@/src/lib/api/clients/index.js';
import type { TimedOutCategories} from '@/src/lib/api/timeouts/timeouts.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';

/**
 * A representation of what went wrong when interacting with the DevOps API.
 *
 * @field id - The API-specific error code.
 * @field message - A user-friendly error message, if one exists (it most often does).
 *
 * @public
 */
export interface DevOpsAPIErrorDescriptor {
  /**
   * The API-specific error code.
   */
  id: number,
  /**
   * A user-friendly error message, if one exists (it most often does).
   */
  message?: string,
}

/**
 * An abstract class representing *some* exception that occurred related to the DevOps API. This is the base class for all
 * DevOps API errors, and will never be thrown directly.
 *
 * Useful for `instanceof` checks.
 *
 * @public
 */
export abstract class DevOpsAPIError extends Error {}

/**
 * An error thrown when an admin operation timed out.
 *
 * Depending on the method, this may be a request timeout occurring during a specific HTTP request, or can happen over
 * the course of a method involving several requests in a row, such as a blocking `createDatabase`.
 *
 * @field url - The URL that the request was made to.
 * @field timeout - The timeout that was set for the operation, in milliseconds.
 *
 * @public
 */
export class DevOpsAPITimeoutError extends DevOpsAPIError {
  /**
   * The URL that the request was made to.
   */
  public readonly url: string;

  /**
   The timeout that was set for the operation, in milliseconds.
   */
  public readonly timeout: Partial<TimeoutDescriptor>;

  /**
   * Represents which timeouts timed out (e.g. `'requestTimeoutMs'`, `'tableAdminTimeoutMs'`, the provided timeout, etc.)
   */
  public readonly timedOutCategories: TimedOutCategories;

  /**
   * Shouldn't be instantiated directly.
   *
   * @internal
   */
  constructor(info: HTTPRequestInfo, types: TimedOutCategories) {
    super(Timeouts.fmtTimeoutMsg(info.timeoutManager, types));
    this.url = info.url;
    this.timeout = info.timeoutManager.initial();
    this.timedOutCategories = types;
    this.name = 'DevOpsAPITimeoutError';
  }

  /**
   * @internal
   */
  public static mk(this: void, info: HTTPRequestInfo, types: TimedOutCategories): DevOpsAPITimeoutError {
    return new DevOpsAPITimeoutError(info, types);
  }
}

/**
 * An error representing a response from the DevOps API that was not successful (non-2XX status code).
 *
 * @field errors - The error descriptors returned by the API to describe what went wrong.
 * @field rootError - The raw axios error that was thrown.
 * @field status - The HTTP status code of the response, if available.
 *
 * @public
 */
export class DevOpsAPIResponseError extends DevOpsAPIError {
  /**
   * The error descriptors returned by the API to describe what went wrong.
   */
  public readonly errors: DevOpsAPIErrorDescriptor[];

  /**
   * The HTTP status code of the response, if available.
   */
  public readonly status: number;

  /**
   * The "raw", errored response from the API.
   */
  public readonly raw: FetcherResponseInfo;

  /**
   * Shouldn't be instantiated directly.
   *
   * @internal
   */
  constructor(resp: FetcherResponseInfo, data: SomeDoc | undefined) {
    const errors = data?.errors ?? [];
    const maybeMsg = errors.find((e: any) => e.message)?.message;

    const message = (maybeMsg)
      ? `${maybeMsg}${errors.length > 1 ? ` (+ ${errors.length - 1} more errors)` : ''}`
      : `Something went wrong (${errors.length} errors)`;

    super(message);
    this.errors = extractErrorDescriptors(data);
    this.status = resp.status;
    this.raw = resp;
    this.name = 'DevOpsAPIResponseError';
  }
}

function extractErrorDescriptors(data: Record<string, any> | undefined): DevOpsAPIErrorDescriptor[] {
  const errors: { ID: number, message: string }[] = data?.errors || [];

  return errors.map((e) => ({
    id: e.ID,
    message: e.message,
  }));
}
