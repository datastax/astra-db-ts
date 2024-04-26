import type { CuratedAPIResponse, HttpMethodStrings } from '@/src/api';
import type { TimeoutManager } from '@/src/api/timeout-managers';

/**
 * @internal
 */
export interface RequestInfo {
  body: string,
  method: HttpMethodStrings,
  timeoutManager: TimeoutManager,
  headers: Record<string, string>,
}

/**
 * @internal
 */
export type ResponseInfo = CuratedAPIResponse;

/**
 * @internal
 */
export interface Fetcher {
  fetch: (input: string, init: RequestInfo) => Promise<ResponseInfo>,
  disconnectAll: () => Promise<void>,
}

/**
 * @internal
 */
export interface FetchCtx {
  preferred: Fetcher,
  http1: Fetcher,
  preferredType: 'http1' | 'http2',
  closed: { ref: boolean },
  maxTimeMS: number | undefined,
}
