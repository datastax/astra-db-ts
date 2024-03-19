import { HttpClient } from '@/src/api/http-client';
import { DEFAULT_TIMEOUT, HTTP_METHODS } from '@/src/api/constants';
import { DevopsAPITimeout } from '@/src/client/errors';
import { InternalAPIResponse } from '@/src/api/types';

interface DevopsApiRequestInfo {
  path: string,
  timeout?: number,
  method: HTTP_METHODS,
  data?: Record<string, any>,
  params?: Record<string, any>,
}

export class DevopsApiHttpClient extends HttpClient {
  async request(info: DevopsApiRequestInfo): Promise<InternalAPIResponse> {
    const url = this.baseUrl + info.path;

    return this._request({
      url: url,
      method: info.method,
      timeout: info.timeout || DEFAULT_TIMEOUT,
      timeoutError: new DevopsAPITimeout(url, info.timeout || DEFAULT_TIMEOUT),
      params: info.params,
      data: info.data,
    });
  }
}
