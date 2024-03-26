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

import { HTTPRequestStrategy, GuaranteedAPIResponse, InternalHTTPRequestInfo } from '@/src/api/types';
import axios from 'axios';
import { DEFAULT_DATA_API_AUTH_HEADER, DEFAULT_DEVOPS_API_AUTH_HEADER, DEFAULT_TIMEOUT } from '@/src/api/constants';
import http from 'http';
import { logger } from '@/src/logger';

const axiosAgent = axios.create({
  headers: {
    'Accepts': 'application/json',
    'Content-Type': 'application/json',
  },
  // keepAlive pools and reuses TCP connections
  httpAgent: new http.Agent({
    keepAlive: true,
  }),
  timeout: DEFAULT_TIMEOUT,
});

axiosAgent.interceptors.request.use((config) => {
  const { method, url } = config;

  if (logger.isLevelEnabled('http')) {
    logger.http(`--- request ${method?.toUpperCase()} ${url} ${config.data}`,);
  }

  return config;
});

axiosAgent.interceptors.response.use((response) => {
  if (logger.isLevelEnabled('http')) {
    logger.http(`--- response ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} ${JSON.stringify(response.data, null, 2)}`,);
  }
  return response;
});

export const HTTP1AuthHeaderFactories = {
  DataApi(token: string) {
    return { [DEFAULT_DATA_API_AUTH_HEADER]: token };
  },
  DevopsApi(token: string) {
    return { [DEFAULT_DEVOPS_API_AUTH_HEADER]: `Bearer ${token}` };
  },
}

export class HTTP1Strategy implements HTTPRequestStrategy {
  constructor(
    private readonly _authHeaderFactory: (token: string) => Record<string, string>,
  ) {}

  public async request(info: InternalHTTPRequestInfo): Promise<GuaranteedAPIResponse> {
    try {
      return await axiosAgent({
        url: info.url,
        data: info.data,
        params: info.params,
        method: info.method,
        timeout: info.timeout,
        headers: {
          ...this._authHeaderFactory(info.token),
          'User-Agent': info.userAgent,
        },
      });
    } catch (e: any) {
      if (e.code === 'ECONNABORTED') {
        throw info.timeoutError();
      }
      throw e;
    }
  }
}
