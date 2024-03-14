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

import { logger, setLevel } from '@/src/logger';
import { EJSON } from 'bson';
import { DEFAULT_METHOD, DEFAULT_NAMESPACE, DEFAULT_TIMEOUT, HTTP_METHODS, CLIENT_USER_AGENT } from '@/src/api/constants';
import {
  APIResponse,
  Caller,
  HTTPRequestInfo,
  HTTPRequestStrategy,
  InternalHTTPClientOptions
} from '@/src/api/types';
import { HTTP1Strategy } from '@/src/api/http1';
import { HTTP2Strategy } from '@/src/api/http2';
import { BaseOptions } from '@/src/client/types/common';
import { DataAPIResponseError, mkRespErrorFromResponse } from '@/src/client/errors';

export class HTTPClient {
  baseUrl: string;
  applicationToken: string;
  logSkippedOptions: boolean;
  keyspace?: string;
  collection?: string;
  requestStrategy: HTTPRequestStrategy;
  usingHttp2: boolean;
  userAgent: string;

  constructor(options: InternalHTTPClientOptions) {
    if (typeof window !== "undefined") {
      throw new Error("not for use in a web browser");
    }

    if (!options.baseUrl) {
      throw new Error("baseUrl required for initialization");
    }

    if (!options.applicationToken) {
      throw new Error("applicationToken required for initialization");
    }

    this.baseUrl = options.baseUrl;
    this.applicationToken = options.applicationToken;
    this.logSkippedOptions = options.logSkippedOptions ?? false;
    this.collection = options.collectionName;
    this.keyspace = options.keyspaceName || DEFAULT_NAMESPACE;
    this.usingHttp2 = options.useHttp2 ?? true;

    this.requestStrategy = (this.usingHttp2)
      ? new HTTP2Strategy(this.baseUrl)
      : new HTTP1Strategy;

    if (options.logLevel) {
      setLevel(options.logLevel);
    }

    if (options.baseApiPath) {
      this.baseUrl += '/' + options.baseApiPath;
    }

    this.userAgent = buildUserAgent(CLIENT_USER_AGENT, options.caller);
  }

  close() {
    this.requestStrategy.close?.();
  }

  isClosed(): boolean | undefined {
    return this.requestStrategy.closed;
  }

  cloneShallow(): HTTPClient {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  async executeCommand(command: Record<string, any>, options?: BaseOptions, optionsToRetain?: Set<string>) {
    const commandName = Object.keys(command)[0];

    if (command[commandName].options && optionsToRetain) {
      command[commandName].options = cleanupOptions(command, commandName, optionsToRetain, this.logSkippedOptions);
    }

    const response = await this.request({
      url: this.baseUrl,
      method: HTTP_METHODS.post,
      timeout: options?.maxTimeMS ?? DEFAULT_TIMEOUT,
      command: command,
    });

    handleIfErrorResponse(response, command);
    return response;
  }

  async request(requestInfo: HTTPRequestInfo): Promise<APIResponse> {
    try {
      const keyspacePath = this.keyspace ? `/${this.keyspace}` : '';
      const collectionPath = this.collection ? `/${this.collection}` : '';
      const url = requestInfo.url + keyspacePath + collectionPath;

      const response = await this.requestStrategy.request({
        url: url,
        token: this.applicationToken,
        command: requestInfo.command,
        timeout: requestInfo.timeout || DEFAULT_TIMEOUT,
        method: requestInfo.method || DEFAULT_METHOD,
        params: requestInfo.params ?? {},
        userAgent: this.userAgent,
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
        logger.error(requestInfo.url + ": " + response.status);
        logger.error("Data: " + JSON.stringify(requestInfo.command));
        return this._mkError();
      }
    } catch (e: any) {
      logger.error(requestInfo.url + ": " + e.message);
      logger.error("Data: " + JSON.stringify(requestInfo.command));

      if (e?.response?.data) {
        logger.error("Response Data: " + JSON.stringify(e.response.data));
      }

      // return this._mkError(e.message ? e.message : 'Server call failed, please retry!');

      throw e;
    }
  }

  private _mkError(message?: string): APIResponse {
    return (message)
      ? { errors: [{ message }] }
      : {};
  }
}

export function handleIfErrorResponse(response: any, command: Record<string, any>) {
  if (response.errors && response.errors.length > 0) {
    throw mkRespErrorFromResponse(DataAPIResponseError, command, response);
  }
}

export function serializeCommand(data: Record<string, any>, pretty?: boolean): string {
  return EJSON.stringify(
    data,
    (_: unknown, value: any) => handleValues(value),
    pretty ? "  " : "",
  );
}

function deserialize(data?: Record<string, any> | null): Record<string, any> {
  return data ? EJSON.deserialize(data) : data;
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

function buildUserAgent(client: string, caller?: Caller | Caller[]): string {
  const callers = (
    (!caller)
      ? [] :
    Array.isArray(caller[0])
      ? caller
      : [caller]
  ) as Caller[];

  const callerString = callers.map((c) => {
    return c[1] ? `${c[0]}/${c[1]}` : c[0];
  }).join(' ');

  return `${callerString} ${client}`.trim();
}
