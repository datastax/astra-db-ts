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

export class InsertManyOrderedError extends Error {
  constructor(
    readonly baseError: DataAPIError,
    readonly insertedIds: string[],
  ) {
    super(`Insert many ordered partially failed${errorString(baseError.errors ?? [])}${statusString(baseError.status)}`);
    this.name = "InsertManyOrderedError";
  }
}

export class InsertManyUnorderedError extends Error {
  constructor(
    readonly baseErrors: DataAPIError[],
    readonly insertedIds: string[],
    readonly failedIds: string[],
  ) {
    super(`Insert many unordered partially failed with some errors${statusStrings(baseErrors.map(e => e.status))}`);
    this.name = "InsertManyUnorderedError";
  }
}

export class TooManyDocsToCountError extends Error {
  constructor(readonly limit: number) {
    super(`Too many documents to count (provided limit is ${limit})`);
    this.name = "TooManyDocsToCountError";
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
  return (statuses.length > 0)
    ? `, with statuses: ${statuses.filter(s => s).map(status => JSON.stringify(status)).join(", ")}`
    : '';
}
