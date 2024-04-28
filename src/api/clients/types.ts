import type TypedEmitter from 'typed-emitter';
import type { DataAPICommandEvents } from '@/src/data-api';
import type { FetchCtx, HttpMethods } from '@/src/api';
import type { TimeoutManager } from '@/src/api/timeout-managers';

/**
 * @internal
 */
export interface HTTPClientOptions {
  baseUrl: string,
  baseApiPath?: string,
  applicationToken: string,
  emitter: TypedEmitter<DataAPICommandEvents>,
  monitorCommands: boolean,
  fetchCtx: FetchCtx,
}

/**
 * @internal
 */
export type AuthHeaderFactory = (token: string) => Record<string, any>;

/**
 * @internal
 */
export type HttpMethodStrings = typeof HttpMethods[keyof typeof HttpMethods];

/**
 * @internal
 */
export interface HTTPRequestInfo {
  url: string,
  data?: string,
  params?: Record<string, string>,
  method: HttpMethodStrings,
  timeoutManager: TimeoutManager,
  forceHttp1?: boolean,
}
