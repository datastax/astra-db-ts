import type { AxiosError, AxiosResponse } from 'axios';
import { DataAPIError } from '@/src/data-api/errors';

export class DevopsAPITimeout extends DataAPIError {
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
  readonly status: number;

  constructor(error: AxiosError) {
    super(error.message);
    this.errors = (<any>error.response)?.data.errors;
    this.status = (<any>error.response)?.status;
    this.rootError = error
    this.name = 'DevopsApiError';
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
