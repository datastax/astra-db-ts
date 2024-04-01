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

import { BaseOptions } from '@/src/data-api/types';
import { DEFAULT_NAMESPACE, DEFAULT_TIMEOUT, HTTP_METHODS, HttpClient, RawDataApiResponse } from '@/src/api';
import { DataAPIResponseError, DataAPITimeout, mkRespErrorFromResponse, ObjectId, UUID } from '@/src/data-api';
import { logger } from '@/src/logger';

interface DataApiRequestInfo {
  url: string;
  timeout?: number;
  collection?: string;
  namespace?: string;
  command: Record<string, any>;
}

export class DataApiHttpClient extends HttpClient {
  public collection?: string;
  public namespace?: string;

  public async executeCommand(command: Record<string, any>, options?: BaseOptions & { collection?: string, namespace?: string }) {
    const response = await this._requestDataApi({
      url: this.baseUrl,
      timeout: options?.maxTimeMS,
      collection: options?.collection,
      namespace: options?.namespace,
      command: command,
    });

    handleIfErrorResponse(response, command);
    return response;
  }

  protected async _requestDataApi(info: DataApiRequestInfo): Promise<RawDataApiResponse> {
    try {
      info.collection ||= this.collection;
      info.namespace ||= this.namespace || DEFAULT_NAMESPACE;

      const keyspacePath = `/${info.namespace}`;
      const collectionPath = info.collection ? `/${info.collection}` : '';
      const url = info.url + keyspacePath + collectionPath;

      const response = await this._request({
        url: url,
        data: JSON.stringify(info.command, replacer),
        timeout: info.timeout,
        method: HTTP_METHODS.Post,
        timeoutError() {
          return new DataAPITimeout(info.command, info.timeout || DEFAULT_TIMEOUT);
        },
        reviver: reviver,
      });

      if (response.status === 401 || (response.data?.errors?.length > 0 && response.data?.errors[0]?.message === 'UNAUTHENTICATED: Invalid token')) {
        return this._mkError('Authentication failed; is your token valid?');
      }

      if (response.status === 200) {
        return {
          status: response.data?.status,
          data: response.data?.data,
          errors: response.data?.errors,
        };
      } else {
        logger.error(info.url + ": " + response.status);
        logger.error("Data: " + JSON.stringify(info.command));
        return this._mkError(`Some non-200 status code was returned. Check the logs for more information. ${response.status}, ${JSON.stringify(response.data)}`);
      }
    } catch (e: any) {
      logger.error(info.url + ": " + e.message);
      logger.error("Data: " + JSON.stringify(info.command));

      if (e?.response?.data) {
        logger.error("Response Data: " + JSON.stringify(e.response.data));
      }

      throw e;
    }
  }

  private _mkError(message: string): RawDataApiResponse {
    return { errors: [{ message }] };
  }
}

export function replacer(this: any, key: string, value: any): any {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof this[key] === 'object') {
    if (value instanceof ObjectId) {
      return { $objectId: value.toString() };
    }

    if (value instanceof UUID) {
      return { $uuid: value.toString() };
    }

    if (key === '$date') {
      return new Date(value).valueOf();
    }

    if (this[key] instanceof Date) {
      return { $date: this[key].valueOf() };
    }
  }

  return value;
}

export function reviver(_: string, value: any): any {
  if (!value) {
    return value;
  }
  if (value.$date) {
    return new Date(value.$date);
  }
  if (value.$objectId) {
    return new ObjectId(value.$objectId);
  }
  if (value.$uuid) {
    return new UUID(value.$uuid);
  }
  return value;
}

export function handleIfErrorResponse(response: any, command: Record<string, any>) {
  if (response.errors && response.errors.length > 0) {
    throw mkRespErrorFromResponse(DataAPIResponseError, command, response);
  }
}
