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

import { APIResponse } from '@/src/api';

export class DataAPIError extends Error implements APIResponse {
  errors: any[];
  status?: Record<string, any>;
  data?: Record<string, any>;
  command: Record<string, any>;

  constructor(response: APIResponse, command: Record<string, any>) {
    const commandName = Object.keys(command)[0] || "unknown";
    super(`Command "${commandName}" failed${errorString(response.errors ?? [])}${statusString(response.status)}`);

    this.errors = response.errors ?? [];
    this.status = response.status;
    this.data = response.data;
    this.command = command;
    this.name = "DataAPIError";
  }
}

export class DataAPITimeout extends Error {
  constructor(readonly command: Record<string, any>, readonly timeout: number) {
    super(`Command timed out after ${timeout}ms`);
    this.name = "DataAPITimeout";
  }
}

/**
 * Error thrown on ordered `insertMany`s when a Data-API-related error occurs.
 *
 * Not thrown for other errors, such as `5xx`s or network errors.
 */
export class InsertManyOrderedError extends Error {
  /**
   * The base {@link DataAPIError} that caused the error.
   */
  baseError: DataAPIError;

  /**
   * The IDs of the documents that were successfully inserted. Given that the operation is ordered, the failed
   * documents & IDs are those that come after the last successful one.
   */
  insertedIds: string[];

  constructor(baseError: DataAPIError, insertedIds: string[]) {
    super(`Insert many ordered partially failed${errorString(baseError.errors ?? [])}${statusString(baseError.status)}`);
    this.baseError = baseError;
    this.insertedIds = insertedIds;
    this.name = "InsertManyOrderedError";
  }
}

/**
 * Error thrown on unordered `insertMany`s when a Data-API-related error occurs.
 *
 * Not thrown for other errors, such as `5xx`s or network errors.
 *
 * Thrown after every document has been attempted to be inserted, regardless of success or failure (unlike `5xx`s and
 * similar, which are thrown immediately).
 */
export class InsertManyUnorderedError extends Error {
  /**
   * The aggregate of all {@link DataAPIError}s that caused the error.
   */
  baseErrors: DataAPIError[];

  /**
   * The IDs of the documents that were successfully inserted.
   */
  insertedIds: string[];

  /**
   * The IDs of the documents that failed to be inserted.
   */
  failedIds: string[];

  constructor(baseErrors: DataAPIError[], insertedIds: string[], failedIds: string[]) {
    super(`Insert many unordered partially failed with some errors${statusStrings(baseErrors.map(e => e.status))}`);
    this.baseErrors = baseErrors;
    this.insertedIds = insertedIds;
    this.failedIds = failedIds;
    this.name = "InsertManyUnorderedError";
  }
}

export class TooManyDocsToCountError extends Error {
  constructor(readonly limit: number, readonly hitServerLimit: boolean) {
    const message = (hitServerLimit)
      ? `Too many documents to count (server limit of ${limit} reached)`
      : `Too many documents to count (provided limit is ${limit})`;
    super(message);

    this.name = "TooManyDocsToCountError";
  }
}

export class CursorAlreadyInitializedError extends Error {
  constructor(message: string = 'Cursor is already initialized') {
    super(message);
    this.name = 'CursorAlreadyInitializedError';
  }
}

const MAX_ERRORS_DISPLAYED = 5;

const errorString = (errors: any[]) => {
  const moreErrors = errors.length - MAX_ERRORS_DISPLAYED;
  errors = errors.slice(0, MAX_ERRORS_DISPLAYED);

  return (errors.length > 0)
    ? `, with errors: ${errors.map(e => JSON.stringify(e)).join(", ")}${moreErrors > 0 ? `and ${moreErrors} more errors` : ''}`
    : '';
}

const statusString = (status?: Record<string, any>) => {
  return (status)
    ? `, with status: ${JSON.stringify(status)}`
    : '';
}

const statusStrings = (statuses: (Record<string, any> | undefined)[]) => {
  const moreStatuses = statuses.length - MAX_ERRORS_DISPLAYED;
  statuses = statuses.slice(0, MAX_ERRORS_DISPLAYED);

  return (statuses.length > 0)
    ? `, with statuses: ${statuses.map(s => JSON.stringify(s)).join(", ")}${moreStatuses > 0 ? `and ${moreStatuses} more statuses` : ''}`
    : '';
}
