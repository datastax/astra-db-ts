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
// noinspection ExceptionCaughtLocallyJS

import { Logger } from '@/src/lib/logging/logger';
import { nullish, RawDataAPIResponse, TokenProvider } from '@/src/lib';
import {
  DataAPIErrorDescriptor,
  DataAPIHttpError,
  DataAPIResponseError,
  DataAPITimeoutError,
  EmbeddingHeadersProvider,
  SomeDoc,
} from '@/src/documents';
import type { HeaderProvider, HTTPClientOptions, KeyspaceRef } from '@/src/lib/api/clients/types';
import { HttpClient } from '@/src/lib/api/clients/http-client';
import { DEFAULT_DATA_API_AUTH_HEADER, HttpMethods } from '@/src/lib/api/constants';
import { CollectionSpawnOptions, TableSpawnOptions } from '@/src/db';
import type { AdminSpawnOptions } from '@/src/client';
import { isNullish } from '@/src/lib/utils';
import { mkRespErrorFromResponse } from '@/src/documents/errors';
import { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts';

/**
 * @internal
 */
type ExecuteCommandOptions = {
  keyspace?: string | null,
  timeoutManager: TimeoutManager,
  bigNumsPresent?: boolean,
  collection?: string,
}

/**
 * @internal
 */
export interface DataAPIRequestInfo {
  url: string,
  collection?: string,
  keyspace?: string | null,
  command: Record<string, any>,
  timeoutManager: TimeoutManager,
  bigNumsPresent: boolean | undefined,
}

type EmissionStrategy = (logger: Logger) => {
  emitCommandStarted?(info: DataAPIRequestInfo): void,
  emitCommandFailed?(info: DataAPIRequestInfo, error: Error, started: number): void,
  emitCommandSucceeded?(info: DataAPIRequestInfo, resp: RawDataAPIResponse, started: number): void,
  emitCommandWarnings?(info: DataAPIRequestInfo, warnings: DataAPIErrorDescriptor[]): void,
}

export const EmissionStrategy: Record<'Normal' | 'Admin', EmissionStrategy> = {
  Normal: (logger) => ({
    emitCommandStarted: logger.commandStarted,
    emitCommandFailed: logger.commandFailed,
    emitCommandSucceeded: logger.commandSucceeded,
    emitCommandWarnings: logger.commandWarnings,
  }),
  Admin: (logger) => ({
    emitCommandStarted(info) {
      logger.adminCommandStarted?.(adaptInfo4Devops(info), true, null!); // TODO
    },
    emitCommandFailed(info, error, started) {
      logger.adminCommandFailed?.(adaptInfo4Devops(info), true, error, started);
    },
    emitCommandSucceeded(info, resp, started) {
      logger.adminCommandSucceeded?.(adaptInfo4Devops(info), true, resp, started);
    },
    emitCommandWarnings(info, warnings) {
      logger.adminCommandWarnings?.(adaptInfo4Devops(info), true, warnings);
    },
  }),
};

const adaptInfo4Devops = (info: DataAPIRequestInfo) => (<const>{
  method: 'POST',
  data: info.command,
  path: info.url,
  params: {},
});

/**
 * @internal
 */
interface DataAPIHttpClientOpts extends HTTPClientOptions {
  keyspace: KeyspaceRef,
  emissionStrategy: EmissionStrategy,
  embeddingHeaders: EmbeddingHeadersProvider,
  tokenProvider: TokenProvider | undefined,
}

export interface BigNumberHack {
  parseWithBigNumbers(json: string): boolean,
  parser: {
    parse: (json: string) => SomeDoc,
    stringify: (obj: SomeDoc) => string,
  },
}

/**
 * @internal
 */
export class DataAPIHttpClient extends HttpClient {
  public collection?: string;
  public keyspace: KeyspaceRef;
  public emissionStrategy: ReturnType<EmissionStrategy>;
  public bigNumHack?: BigNumberHack;
  readonly #props: DataAPIHttpClientOpts;

  constructor(props: DataAPIHttpClientOpts) {
    super(props, [mkAuthHeaderProvider(props.tokenProvider), () => props.embeddingHeaders.getHeaders()], DataAPITimeoutError.mk);
    this.keyspace = props.keyspace;
    this.#props = props;
    this.emissionStrategy = props.emissionStrategy(this.logger);
  }

  public forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(keyspace: string, collection: string, opts: CollectionSpawnOptions<any> | TableSpawnOptions<any> | undefined, bigNumHack: BigNumberHack): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      embeddingHeaders: EmbeddingHeadersProvider.parseHeaders(opts?.embeddingApiKey),
      logging: Logger.advanceConfig(this.#props.logging, opts?.logging),
      keyspace: { ref: keyspace },
    });

    clone.collection = collection;
    clone.bigNumHack = bigNumHack;
    clone.tm = new Timeouts(DataAPITimeoutError.mk, { ...this.tm.baseTimeouts, ...opts?.timeoutDefaults });

    return clone;
  }

  public forDbAdmin(opts: AdminSpawnOptions | undefined): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      tokenProvider: TokenProvider.parseToken([opts?.adminToken, this.#props.tokenProvider], 'admin token'),
      logging: Logger.advanceConfig(this.#props.logging, opts?.logging),
      baseUrl: opts?.endpointUrl ?? this.#props.baseUrl,
      baseApiPath: opts?.endpointUrl ? '' : this.#props.baseApiPath,
      additionalHeaders: { ...this.#props.additionalHeaders, ...opts?.additionalHeaders },
    });

    clone.collection = undefined;
    clone.emissionStrategy = EmissionStrategy.Admin(clone.logger);
    clone.tm = new Timeouts(DataAPITimeoutError.mk, { ...this.tm.baseTimeouts, ...opts?.timeoutDefaults });

    return clone;
  }

  public async executeCommand(command: Record<string, any>, options: ExecuteCommandOptions) {
    return await this._requestDataAPI({
      url: this.baseUrl,
      timeoutManager: options.timeoutManager,
      collection: options?.collection,
      keyspace: options?.keyspace,
      command: command,
      bigNumsPresent: options?.bigNumsPresent,
    });
  }

  private async _requestDataAPI(info: DataAPIRequestInfo): Promise<RawDataAPIResponse> {
    let started = 0;

    try {
      info.collection ||= this.collection;

      if (info.keyspace !== null) {
        info.keyspace ||= this.keyspace?.ref;

        if (isNullish(info.keyspace)) {
          throw new Error('Db is missing a required keyspace; be sure to set one w/ client.db(..., { keyspace }), or db.useKeyspace()');
        }
      }

      const keyspacePath = info.keyspace ? `/${info.keyspace}` : '';
      const collectionPath = info.collection ? `/${info.collection}` : '';
      info.url += keyspacePath + collectionPath;

      started = performance.now();
      this.emissionStrategy.emitCommandStarted?.(info);

      const command = (info.bigNumsPresent)
        ? this.bigNumHack?.parser.stringify(info.command)
        : JSON.stringify(info.command);

      const resp = await this._request({
        url: info.url,
        data: command,
        timeoutManager: info.timeoutManager,
        method: HttpMethods.Post,
      });

      if (resp.status >= 400 && resp.status !== 401) {
        throw new DataAPIHttpError(resp);
      }

      const data: RawDataAPIResponse =
        (resp.body)
          ? (this.bigNumHack?.parseWithBigNumbers(resp.body))
            ? this.bigNumHack?.parser.parse(resp.body)
            : JSON.parse(resp.body)
          : {};

      const warnings = data?.status?.warnings ?? [];
      if (warnings.length) {
        this.emissionStrategy.emitCommandWarnings?.(info, warnings);
      }
      delete data?.status?.warnings;

      if (data.errors && data.errors.length > 0) {
        throw mkRespErrorFromResponse(DataAPIResponseError, info.command, data, warnings);
      }

      const respData = {
        data: data.data,
        status: data.status,
        errors: data.errors,
      };

      this.emissionStrategy.emitCommandSucceeded?.(info, respData, started);
      return respData;
    } catch (e: any) {
      this.emissionStrategy.emitCommandFailed?.(info, e, started);
      throw e;
    }
  }
}

const mkAuthHeaderProvider = (tp: TokenProvider | undefined): HeaderProvider => (tp)
  ? () => {
    const token = tp.getToken();

    return (token instanceof Promise)
      ? token.then(mkAuthHeader)
      : mkAuthHeader(token);
  } : () => ({});

const mkAuthHeader = (token: string | nullish): Record<string, string> => (token)
  ? { [DEFAULT_DATA_API_AUTH_HEADER]: token }
  : {};
