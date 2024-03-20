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

import { BaseOptions } from '@/src/client/types';
import { DEFAULT_NAMESPACE, DEFAULT_TIMEOUT, HTTP_METHODS, HttpClient, RawDataApiResponse } from '@/src/api';
import { DataAPIResponseError, DataAPITimeout, mkRespErrorFromResponse } from '@/src/client';
import { logger } from '@/src/logger';
import { EJSON } from 'bson';

interface DataApiRequestInfo {
  url: string;
  timeout?: number;
  collection?: string;
  command: Record<string, any>;
}

export class DataApiHttpClient extends HttpClient {
  collection?: string;
  namespace?: string;

  async executeCommand(command: Record<string, any>, options?: BaseOptions & { collection?: string }, optionsToRetain?: Set<string>) {
    const commandName = Object.keys(command)[0];

    if (command[commandName].options && optionsToRetain) {
      command[commandName].options = cleanupOptions(command, commandName, optionsToRetain, this.logSkippedOptions);
    }

    const response = await this._requestDataApi({
      url: this.baseUrl,
      timeout: options?.maxTimeMS,
      collection: options?.collection,
      command: command,
    });

    handleIfErrorResponse(response, command);
    return response;
  }

  protected async _requestDataApi(info: DataApiRequestInfo): Promise<RawDataApiResponse> {
    try {
      info.collection ||= this.collection;

      const keyspacePath = `/${this.namespace ?? DEFAULT_NAMESPACE}`;
      const collectionPath = info.collection ? `/${info.collection}` : '';
      const url = info.url + keyspacePath + collectionPath;

      const response = await this._request({
        url: url,
        data: serializeCommand(info.command),
        timeout: info.timeout,
        method: HTTP_METHODS.post,
        timeoutError: new DataAPITimeout(info.command, info.timeout || DEFAULT_TIMEOUT),
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
  return EJSON.stringify(data, (_: unknown, value: any) => handleValues(value), pretty ? '  ' : '');
}

function handleValues(value: any): any {
  if (value && typeof value === "bigint") {
    // BigInt handling
    return Number(value);
  } else if (value && typeof value === "object") {
    // ObjectId to strings
    if (value.$oid) {
      return value.$oid;
    } else if (value.$numberDecimal) {
      // Decimal128 handling
      return Number(value.$numberDecimal);
    } else if (value.$binary?.subType === "03" || value.$binary?.subType === "04") {
      // UUID handling. Subtype 03 or 04 is UUID. Refer spec : https://bsonspec.org/spec.html
      return Buffer.from(value.$binary.base64, "base64")
        .toString("hex")
        .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    }
    // Date handling
    else if (value.$date) {
      // Use numbers instead of strings for dates
      value.$date = new Date(value.$date).valueOf();
    }
  }
  // all other values
  return value;
}

function deserialize(data?: Record<string, any> | null): Record<string, any> {
  return data ? EJSON.deserialize(data) : data;
}

export function handleIfErrorResponse(response: any, command: Record<string, any>) {
  if (response.errors && response.errors.length > 0) {
    throw mkRespErrorFromResponse(DataAPIResponseError, command, response);
  }
}
