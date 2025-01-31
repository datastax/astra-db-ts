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
import { nullish, ParsedTokenProvider, RawDataAPIResponse, TokenProvider } from '@/src/lib';
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
import { CollectionOptions, TableOptions } from '@/src/db';
import { isNullish } from '@/src/lib/utils';
import { mkRespErrorFromResponse } from '@/src/documents/errors';
import { TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts';
import { EmptyObj } from '@/src/lib/types';
import { ParsedAdminOpts } from '@/src/client/opts-handlers/admin-opts-handler';

type ClientKind = 'admin' | 'normal';

/**
 * @internal
 */
type ExecCmdOpts<Kind extends ClientKind> = (Kind extends 'admin' ? { methodName: string } : EmptyObj) & {
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

/**
 * @internal
 */
type EmissionStrategy<Kind extends ClientKind> = (logger: Logger) => {
  emitCommandStarted?(info: DataAPIRequestInfo, opts: ExecCmdOpts<Kind>): void,
  emitCommandFailed?(info: DataAPIRequestInfo, error: Error, started: number, opts: ExecCmdOpts<Kind>): void,
  emitCommandSucceeded?(info: DataAPIRequestInfo, resp: RawDataAPIResponse, started: number, opts: ExecCmdOpts<Kind>): void,
  emitCommandWarnings?(info: DataAPIRequestInfo, warnings: DataAPIErrorDescriptor[], opts: ExecCmdOpts<Kind>): void,
}

/**
 * @internal
 */
type EmissionStrategies = {
  Normal: EmissionStrategy<'normal'>,
  Admin: EmissionStrategy<'admin'>,
}

/**
 * @internal
 */
export const EmissionStrategy: EmissionStrategies = {
  Normal: (logger) => ({
    emitCommandStarted: logger.commandStarted,
    emitCommandFailed: logger.commandFailed,
    emitCommandSucceeded: logger.commandSucceeded,
    emitCommandWarnings: logger.commandWarnings,
  }),
  Admin: (logger) => ({
    emitCommandStarted(info, opts) {
      logger.adminCommandStarted?.(adaptInfo4Devops(info, opts.methodName), true, null!); // TODO
    },
    emitCommandFailed(info, error, started, opts) {
      logger.adminCommandFailed?.(adaptInfo4Devops(info, opts.methodName), true, error, started);
    },
    emitCommandSucceeded(info, resp, started, opts) {
      logger.adminCommandSucceeded?.(adaptInfo4Devops(info, opts.methodName), true, resp, started);
    },
    emitCommandWarnings(info, warnings, opts) {
      logger.adminCommandWarnings?.(adaptInfo4Devops(info, opts.methodName), true, warnings);
    },
  }),
};

const adaptInfo4Devops = (info: DataAPIRequestInfo, methodName: string) => (<const>{
  method: 'POST',
  data: info.command,
  path: info.url,
  methodName,
});

/**
 * @internal
 */
interface DataAPIHttpClientOpts<Kind extends ClientKind> extends HTTPClientOptions {
  keyspace: KeyspaceRef,
  emissionStrategy: EmissionStrategy<Kind>,
  embeddingHeaders: EmbeddingHeadersProvider,
  tokenProvider: ParsedTokenProvider,
}

/**
 * @internal
 */
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
export class DataAPIHttpClient<Kind extends ClientKind = 'normal'> extends HttpClient {
  public collection?: string;
  public keyspace: KeyspaceRef;
  public emissionStrategy: ReturnType<EmissionStrategy<Kind>>;
  public bigNumHack?: BigNumberHack;
  readonly #props: DataAPIHttpClientOpts<Kind>;

  constructor(props: DataAPIHttpClientOpts<Kind>) {
    super(props, [mkAuthHeaderProvider(props.tokenProvider), () => props.embeddingHeaders.getHeaders()], DataAPITimeoutError.mk);
    this.keyspace = props.keyspace;
    this.#props = props;
    this.emissionStrategy = props.emissionStrategy(this.logger);
  }

  public forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(keyspace: string, collection: string, opts: CollectionOptions | TableOptions | undefined, bigNumHack: BigNumberHack): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      embeddingHeaders: EmbeddingHeadersProvider.parse(opts?.embeddingApiKey),
      logging: Logger.cfg.concatParseWithin([this.#props.logging], opts, 'logging'),
      emissionStrategy: EmissionStrategy.Normal,
      keyspace: { ref: keyspace },
    });

    clone.collection = collection;
    clone.bigNumHack = bigNumHack;
    clone.tm = new Timeouts(DataAPITimeoutError.mk, Timeouts.cfg.parse({ ...this.tm.baseTimeouts, ...opts?.timeoutDefaults }));

    return clone;
  }

  public forDbAdmin(opts: ParsedAdminOpts): DataAPIHttpClient<'admin'> {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      tokenProvider: TokenProvider.opts.concat(opts.adminToken, this.#props.tokenProvider),
      logging: Logger.cfg.concat(this.#props.logging, opts.logging),
      baseUrl: opts?.endpointUrl ?? this.#props.baseUrl,
      baseApiPath: opts?.endpointUrl ? '' : this.#props.baseApiPath,
      additionalHeaders: { ...this.#props.additionalHeaders, ...opts?.additionalHeaders },
      emissionStrategy: EmissionStrategy.Admin,
    });

    clone.collection = undefined;
    clone.tm = new Timeouts(DataAPITimeoutError.mk, { ...this.tm.baseTimeouts, ...opts?.timeoutDefaults });

    return clone;
  }

  public async executeCommand(command: Record<string, any>, options: ExecCmdOpts<Kind>): Promise<RawDataAPIResponse> {
    let started = 0;

    const info: DataAPIRequestInfo = {
      url: this.baseUrl,
      collection: options.collection,
      keyspace: options.keyspace,
      command: command,
      timeoutManager: options.timeoutManager,
      bigNumsPresent: options.bigNumsPresent,
    };

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
      this.emissionStrategy.emitCommandStarted?.(info, options);

      const serialized = (info.bigNumsPresent)
        ? this.bigNumHack?.parser.stringify(info.command)
        : JSON.stringify(info.command);

      const resp = await this._request({
        url: info.url,
        data: serialized,
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
        this.emissionStrategy.emitCommandWarnings?.(info, warnings, options);
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

      this.emissionStrategy.emitCommandSucceeded?.(info, respData, started, options);
      return respData;
    } catch (e: any) {
      this.emissionStrategy.emitCommandFailed?.(info, e, started, options);
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
