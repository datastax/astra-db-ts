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
  errors?: any[];
  status?: Record<string, any>;
  data?: Record<string, any>;
  command: Record<string, any>;

  constructor(response: APIResponse, command: Record<string, any>) {
    const commandName = Object.keys(command)[0] || "unknown";
    const status = response.status ? `, status: ${JSON.stringify(response.status)}` : '';
    super(`Command "${commandName}" failed with the following errors: ${JSON.stringify(response.errors)}${status}`);

    this.errors = response.errors;
    this.status = response.status;
    this.data = response.data;
    this.command = command;
    this.name = "DataAPIError";
  }
}

export class DataAPITimeout extends Error {
  constructor(readonly command: Record<string, any>) {
    super("Command timed out");
    this.name = "DataAPITimeout";
  }
}

export class InsertManyOrderedError extends Error {
  constructor(
    readonly baseError: Error,
    readonly insertedIDs: string[],
    readonly failedInserts: { _id: unknown }[],
  ) {
    super(baseError.message);
    this.name = "InsertManyOrderedError";
  }
}
