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

import { Caller } from '@/src/client';
import { TimeoutManager } from '@/src/api/timeout-managers';
import { HttpMethods } from '@/src/api/constants';
import TypedEmitter from 'typed-emitter';
import { DataAPICommandEvents } from '@/src/data-api/events';

/**
 * @internal
 */
export interface HTTPClientOptions {
  baseUrl: string;
  caller?: Caller | Caller[];
  baseApiPath?: string;
  applicationToken: string;
  useHttp2?: boolean;
  requestStrategy?: HTTPRequestStrategy;
  userAgent?: string;
  emitter: TypedEmitter<DataAPICommandEvents>;
  monitorCommands: boolean;
}

export interface RawDataAPIResponse {
  status?: Record<string, any>;
  errors?: any[];
  data?: Record<string, any>;
}

/**
 * @internal
 */
export interface GuaranteedAPIResponse {
  data?: Record<string, any>,
  headers: Record<string, string>,
  status: number,
}

/**
 * @internal
 */
export type HttpMethodStrings = typeof HttpMethods[keyof typeof HttpMethods];

/**
 * @internal
 */
export interface HTTPRequestInfo {
  url: string,
  data?: unknown,
  params?: Record<string, string>,
  method: HttpMethodStrings,
  reviver?: (key: string, value: any) => any,
  timeoutManager: TimeoutManager,
}

/**
 * @internal
 */
export interface InternalHTTPRequestInfo extends HTTPRequestInfo {
  token: string,
  method: HttpMethodStrings,
  userAgent: string,
}

/**
 * @internal
 */
export interface HTTPRequestStrategy {
  request: (params: InternalHTTPRequestInfo) => Promise<GuaranteedAPIResponse>;
  close?: () => void;
  closed?: boolean;
}
