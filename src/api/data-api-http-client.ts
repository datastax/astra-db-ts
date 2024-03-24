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

  public async executeCommand(command: Record<string, any>, options?: BaseOptions & { collection?: string, namespace?: string }, optionsToRetain?: Set<string>) {
    const commandName = Object.keys(command)[0];

    if (command[commandName].options && optionsToRetain) {
      command[commandName].options = cleanupOptions(command, commandName, optionsToRetain, this.logSkippedOptions);
    }

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
        data: serializeCommand(info.command),
        timeout: info.timeout,
        method: HTTP_METHODS.Post,
        timeoutError: () => new DataAPITimeout(info.command, info.timeout || DEFAULT_TIMEOUT),
      });

      if (response.status === 401 || (response.data?.errors?.length > 0 && response.data?.errors[0]?.message === "UNAUTHENTICATED: Invalid token")) {
        return this._mkError("Authentication failed; is your token valid?");
      }

      if (response.status === 200) {
        return {
          status: response.data?.status,
          data: deserialize(response.data?.data),
          errors: response.data?.errors,
        };
      } else {
        logger.error(info.url + ": " + response.status);
        logger.error("Data: " + JSON.stringify(info.command));
        return this._mkError();
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

  private _mkError(message?: string): RawDataApiResponse {
    return (message)
      ? { errors: [{ message }] }
      : {};
  }
}

function cleanupOptions(data: Record<string, any>, commandName: string, optionsToRetain: Set<string>, logSkippedOptions: boolean) {
  const command = data[commandName];

  if (!command.options) {
    return undefined;
  }

  const options = { ...command.options };

  Object.keys(options).forEach((key) => {
    if (!optionsToRetain.has(key)) {
      if (logSkippedOptions) {
        logger.warn(`'${commandName}' does not support option '${key}'`);
      }
      delete options[key];
    }
  });

  return options;
}

function serializeCommand(data: Record<string, any>, pretty?: boolean): string {
  return JSON.stringify(data, (_: unknown, value: any) => handleValues(value), pretty ? '  ' : '');
}

function handleValues(value: any): any {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  } else if (typeof value === "object") {
    if (value.$date) {
      value.$date = 'new Date(value.$date).valueOf()';
    }

    if (value._id instanceof ObjectId) {
      value._id = { $objectId: value._id.toString() };
    } else if (value._id instanceof UUID) {
      value._id = { $uuid: value._id.toString() };
    }
  }

  return value;
}

function deserialize(data?: Record<string, any> | null): Record<string, any> {
  if (!data) {
    return {};
  }

  return data;
}

export function handleIfErrorResponse(response: any, command: Record<string, any>) {
  if (response.errors && response.errors.length > 0) {
    throw mkRespErrorFromResponse(DataAPIResponseError, command, response);
  }
}
