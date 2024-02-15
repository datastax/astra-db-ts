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

import http from 'http';
import axios, { AxiosRequestConfig, } from 'axios';
import { logger, setLevel } from '@/src/logger';
import { inspect } from 'util';
import { LIB_NAME, LIB_VERSION } from '../version';
import { EJSON } from 'bson';

const REQUESTED_WITH = LIB_NAME + "/" + LIB_VERSION;
const DEFAULT_AUTH_HEADER = "Token";
const DEFAULT_METHOD = "get";
const DEFAULT_TIMEOUT = 30000;

const HTTP_METHODS = {
  get: "GET",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
};

interface APIClientOptions {
  applicationToken: string;
  baseUrl: string;
  baseApiPath?: string;
  logLevel?: string;
  logSkippedOptions?: boolean;
  collectionName?: string;
}

export interface APIResponse {
  status?: any;
  data?: any;
  errors?: any;
}

const axiosAgent = axios.create({
  headers: {
    Accepts: "application/json",
    "Content-Type": "application/json",
    "User-Agent": `${REQUESTED_WITH} ${axios.defaults.headers.common["User-Agent"]}`,
    "X-Requested-With": REQUESTED_WITH,
  },
  // keepAlive pools and reuses TCP connections
  httpAgent: new http.Agent({
    keepAlive: true,
  }),
  timeout: DEFAULT_TIMEOUT,
});

axiosAgent.interceptors.request.use((config) => {
  const { method, url } = config;

  if (logger.isLevelEnabled("http")) {
    logger.http(`--- request ${method?.toUpperCase()} ${url} ${serializeCommand(config.data, true,)}`,);
  }

  config.data = serializeCommand(config.data);
  return config;
});

axiosAgent.interceptors.response.use((response) => {
  if (logger.isLevelEnabled("http")) {
    logger.http(`--- response ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} ${JSON.stringify(response.data, null, 2)}`,);
  }
  return response;
});

export class HTTPClient {
  baseUrl: string;
  applicationToken: string;
  logSkippedOptions: boolean;
  collectionName?: string;

  constructor(options: APIClientOptions) {
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
    this.collectionName = options.collectionName;
    this.applicationToken = options.applicationToken;
    this.logSkippedOptions = options.logSkippedOptions || false;

    if (options.logLevel) {
      setLevel(options.logLevel);
    }

    if (options.baseApiPath) {
      this.baseUrl += "/" + options.baseApiPath;
    }
  }

  async _request(requestInfo: AxiosRequestConfig): Promise<APIResponse> {
    try {
      if (!this.applicationToken) {
        return {
          errors: [
            {
              message: "Unable to get token for the credentials provided",
            },
          ],
        };
      }

      const url = requestInfo.url + '/default_keyspace' + (this.collectionName ? `/${this.collectionName}` : "");

      const response = await axiosAgent({
        url: url,
        data: requestInfo.data,
        params: requestInfo.params,
        method: requestInfo.method || DEFAULT_METHOD,
        timeout: requestInfo.timeout || DEFAULT_TIMEOUT,
        headers: {
          [DEFAULT_AUTH_HEADER]: this.applicationToken,
        },
      });
      if (
        response.status === 401 ||
        (response.data?.errors?.length > 0 &&
          response.data.errors[0]?.message === "UNAUTHENTICATED: Invalid token")
      ) {
        return {
          errors: [
            {
              message: "Authentication failed, is your token valid?",
            },
          ],
        };
      }
      if (response.status === 200) {
        return {
          status: response.data.status,
          data: deserialize(response.data.data),
          errors: response.data.errors,
        };
      } else {
        logger.error(requestInfo.url + ": " + response.status);
        logger.error("Data: " + inspect(requestInfo.data));
        return {
          errors: [
            {
              message: "Server response received : " + response.status + "!",
            },
          ],
        };
      }
    } catch (e: any) {
      logger.error(requestInfo.url + ": " + e.message);
      logger.error("Data: " + inspect(requestInfo.data));
      if (e?.response?.data) {
        logger.error("Response Data: " + inspect(e.response.data));
      }
      return {
        errors: [
          {
            message: e.message
              ? e.message
              : "Server call failed, please retry!",
          },
        ],
      };
    }
  }

  async executeCommand(
    data: Record<string, any>,
    optionsToRetain: Set<string> | null,
  ) {
    const commandName = Object.keys(data)[0];

    cleanupOptions(
      commandName,
      data[commandName],
      optionsToRetain,
      this.logSkippedOptions,
    );

    const response = await this._request({
      url: this.baseUrl,
      method: HTTP_METHODS.post,
      data,
    });

    handleIfErrorResponse(response, data);
    return response;
  }
}

export class StargateServerError extends Error {
  errors: any[];
  command: Record<string, any>;
  status: any;

  constructor(response: any, command: Record<string, any>) {
    const commandName = Object.keys(command)[0] || "unknown";
    const status = response.status ? `, Status : ${JSON.stringify(response.status)}` : '';
    super(`Command "${commandName}" failed with the following errors: ${JSON.stringify(response.errors,)}${status}`);
    this.errors = response.errors;
    this.command = command;
    this.status = response.status;
  }
}

export function handleIfErrorResponse (
  response: any,
  data: Record<string, any>,
) {
  if (response.errors && response.errors.length > 0) {
    console.log('handling error response', response, data);
    throw new StargateServerError(response, data);
  }
}

function serializeCommand(data: Record<string, any>, pretty?: boolean): string {
  return EJSON.stringify(
    data,
    (_: unknown, value: any) => handleValues(value),
    pretty ? "  " : "",
  );
}

function deserialize(data: Record<string, any>): Record<string, any> {
  return data != null ? EJSON.deserialize(data) : data;
}

function handleValues(value: any): any {
  if (value != null && typeof value === "bigint") {
    //BigInt handling
    return Number(value);
  } else if (value != null && typeof value === "object") {
    // ObjectId to strings
    if (value.$oid) {
      return value.$oid;
    } else if (value.$numberDecimal) {
      //Decimal128 handling
      return Number(value.$numberDecimal);
    } else if (
      value.$binary &&
      (value.$binary.subType === "03" || value.$binary.subType === "04")
    ) {
      //UUID handling. Subtype 03 or 04 is UUID. Refer spec : https://bsonspec.org/spec.html
      return Buffer.from(value.$binary.base64, "base64")
        .toString("hex")
        .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    }
    //Date handling
    else if (value.$date) {
      // Use numbers instead of strings for dates
      value.$date = new Date(value.$date).valueOf();
    }
  }
  //all other values
  return value;
}

function cleanupOptions(
  commandName: string,
  command: Record<string, any>,
  optionsToRetain: Set<string> | null,
  logSkippedOptions: boolean,
) {
  if (command.options) {
    Object.keys(command.options!).forEach((key) => {
      if (optionsToRetain === null || !optionsToRetain.has(key)) {
        if (logSkippedOptions) {
          logger.warn(`'${commandName}' does not support option '${key}'`);
        }
        delete command.options[key];
      }
    });
  }
}
