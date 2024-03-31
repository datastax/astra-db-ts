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

import type { AxiosError, AxiosResponse } from 'axios';
import { DataAPIError } from '@/src/data-api/errors';

export class DevopsApiTimeout extends DataAPIError {
  constructor(readonly url: string, readonly timeout: number) {
    super(`Command timed out after ${timeout}ms`);
    this.name = 'DevopsAPITimeout';
  }
}

export interface DevopsAPIErrorDescriptor {
  ID?: number,
  message: string,
}

export abstract class DevopsApiError extends Error {}

export class DevopsApiResponseError extends DevopsApiError {
  readonly errors: DevopsAPIErrorDescriptor[];
  readonly rootError: AxiosError;
  readonly status?: number;

  constructor(error: AxiosError) {
    super((<any>error.response)?.data.errors[0]?.message ?? error.message);
    this.errors = (<any>error.response)?.data.errors ?? [];
    this.status = (<any>error.response)?.status;
    this.rootError = error
    this.name = 'DevopsApiResponseError';
  }
}

export class DevopsUnexpectedStateError extends DevopsApiError {
  readonly status?: number;
  readonly rawResponse?: AxiosResponse;

  constructor(message: string, raw?: AxiosResponse) {
    super(message);
    this.rawResponse = raw;
    this.status = raw?.status;
    this.name = 'DevopsUnexpectedStateError';
  }
}
