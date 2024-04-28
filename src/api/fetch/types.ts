import type { CuratedAPIResponse, HttpMethodStrings } from '@/src/api';
import type { TimeoutManager } from '@/src/api/timeout-managers';

/**
 * @internal
 */
export interface RequestInfo {
  url: string,
  body: string | undefined,
  method: HttpMethodStrings,
  timeoutManager: TimeoutManager,
  headers: Record<string, string>,
  forceHttp1: boolean | undefined,
}

/**
 * @internal
 */
export type ResponseInfo = CuratedAPIResponse;

/**
 * @internal
 */
export interface Fetcher {
  fetch: (info: RequestInfo) => Promise<ResponseInfo>,
  disconnectAll: () => Promise<void>,
}

/**
 * @internal
 */
export interface FetchCtx {
  ctx: Fetcher,
  closed: { ref: boolean },
  maxTimeMS: number | undefined,
}
