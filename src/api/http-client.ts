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
  Caller, HTTPClientCloneOptions,
  HTTPRequestInfo,
  HTTPRequestStrategy,
  InternalHTTPClientOptions
} from '@/src/api/types';
import { HTTP1Strategy } from '@/src/api/http1';
import { HTTP2Strategy } from '@/src/api/http2';
import { BaseOptions } from '@/src/client/types/common';
import { DataAPIResponseError, mkRespErrorFromResponse } from '@/src/client/errors';

export class HTTPClient {
  readonly baseUrl: string;
  readonly requestStrategy: HTTPRequestStrategy;
  readonly logSkippedOptions: boolean;
  readonly usingHttp2: boolean;
  readonly userAgent: string;
  readonly #applicationToken: string;
  collection?: string;
  namespace?: string;

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

    this.#applicationToken = options.applicationToken;
    this.baseUrl = options.baseUrl;
    this.logSkippedOptions = options.logSkippedOptions ?? false;
    this.collection = options.collectionName;
    this.namespace = options.keyspaceName || DEFAULT_NAMESPACE;
    this.usingHttp2 = options.useHttp2 ?? true;

    this.requestStrategy =
      (options.requestStrategy)
        ? options.requestStrategy :
      (this.usingHttp2)
        ? new HTTP2Strategy(this.baseUrl)
        : new HTTP1Strategy;

    if (options.logLevel) {
      setLevel(options.logLevel);
    }

    if (options.baseApiPath) {
      this.baseUrl += '/' + options.baseApiPath;
    }

    this.userAgent = options.userAgent ?? buildUserAgent(CLIENT_USER_AGENT, options.caller);

    this._request = this._request.bind(this);
    this.withOptions = this.withOptions.bind(this);
  }

  close() {
    this.requestStrategy.close?.();
  }

  isClosed(): boolean | undefined {
    return this.requestStrategy.closed;
  }

  withOptions(options?: HTTPClientCloneOptions): HTTPClient {
    return new HTTPClient({
      applicationToken: this.#applicationToken,
      baseUrl: this.baseUrl,
      collectionName: options?.collection ?? this.collection,
      keyspaceName: options?.namespace ?? this.namespace,
      useHttp2: this.usingHttp2,
      logSkippedOptions: this.logSkippedOptions,
      requestStrategy: this.requestStrategy,
      userAgent: this.userAgent,
    });
  }

  async executeCommand(command: Record<string, any>, options?: BaseOptions & { collection?: string }, optionsToRetain?: Set<string>) {
    const commandName = Object.keys(command)[0];

    if (command[commandName].options && optionsToRetain) {
      command[commandName].options = cleanupOptions(command, commandName, optionsToRetain, this.logSkippedOptions);
    }

    const response = await this._request({
      url: this.baseUrl,
      method: HTTP_METHODS.post,
      timeout: options?.maxTimeMS ?? DEFAULT_TIMEOUT,
      collection: options?.collection,
      command: command,
    });

    handleIfErrorResponse(response, command);
    return response;
  }

  private async _request(info: HTTPRequestInfo): Promise<APIResponse> {
    try {
      info.collection ||= this.collection;

      const keyspacePath = this.namespace ? `/${this.namespace}` : '';
      const collectionPath = info.collection ? `/${info.collection}` : '';
      const url = info.url + keyspacePath + collectionPath;

      const response = await this.requestStrategy.request({
        url: url,
        token: this.#applicationToken,
        command: info.command,
        timeout: info.timeout || DEFAULT_TIMEOUT,
        method: info.method || DEFAULT_METHOD,
        params: info.params ?? {},
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
