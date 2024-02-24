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

export const enum HTTP_METHODS {
  get = "GET",
  post = "POST",
  put = "PUT",
  patch = "PATCH",
  delete = "DELETE",
}

export interface HTTPClientOptions {
  applicationToken: string;
  baseApiPath?: string;
  logLevel?: string;
  logSkippedOptions?: boolean;
  useHttp2?: boolean;
}

export interface InternalHTTPClientOptions extends HTTPClientOptions {
  baseUrl: string;
  keyspaceName?: string;
  collectionName?: string;
}

export interface APIResponse {
  status?: Record<string, any>;
  errors?: any[];
  data?: Record<string, any>;
}

export interface InternalAPIResponse {
  data?: Record<string, any>,
  status: number,
}

export interface HTTPRequestInfo {
  url: string,
  data?: Record<string, unknown>,
  params?: Record<string, string>,
  method?: HTTP_METHODS,
  timeout?: number,
}

export interface InternalHTTPRequestInfo extends HTTPRequestInfo {
  token: string,
  method: HTTP_METHODS,
  timeout: number,
}

export interface HTTPRequestStrategy {
  request: (params: InternalHTTPRequestInfo) => Promise<InternalAPIResponse>;
  close?: () => void;
  closed?: boolean;
}
