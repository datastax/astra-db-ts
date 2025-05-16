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

import type { InternalLogger } from '@/src/lib/logging/internal-logger.js';
import type { CommandOptions, NonEmpty, RawDataAPIResponse } from '@/src/lib/index.js';
import {
  EmbeddingAPIKeyHeaderProvider,
  HeadersProvider,
  RerankingAPIKeyHeaderProvider,
  TokenProvider,
} from '@/src/lib/index.js';
import type { CommandEventTarget, DataAPIWarningDescriptor, SomeDoc, SomeRow, Table } from '@/src/documents/index.js';
import { Collection, DataAPIHttpError, DataAPIResponseError, DataAPITimeoutError } from '@/src/documents/index.js';
import type { HTTPClientOptions, KeyspaceRef } from '@/src/lib/api/clients/types.js';
import { HttpClient } from '@/src/lib/api/clients/http-client.js';
import { HttpMethods } from '@/src/lib/api/constants.js';
import type { CollectionOptions, TableOptions } from '@/src/db/index.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { EmptyObj } from '@/src/lib/types.js';
import type { ParsedAdminOptions } from '@/src/client/opts-handlers/admin-opts-handler.js';
import type { DbAdmin } from '@/src/administration/index.js';
import { NonErrorError } from '@/src/lib/errors.js';
import type { ParsedTokenProvider } from '@/src/lib/token-providers/token-provider.js';
import type { DevOpsAPIRequestInfo } from '@/src/lib/api/clients/devops-api-http-client.js';
import { isNonEmpty } from '@/src/lib/utils.js';
import { RetryManager } from '@/src/lib/api/retries/manager.js';
import { DataAPIRetryAdapter } from '@/src/lib/api/retries/adapters/data-api.js';

/**
 * @internal
 */
type ClientKind = 'admin' | 'normal';

/**
 * @internal
 */
type ExecCmdOpts<Kind extends ClientKind> = (Kind extends 'admin' ? { methodName: DevOpsAPIRequestInfo['methodName'] } : EmptyObj) & {
  keyspace?: string | null,
  timeoutManager: TimeoutManager,
  bigNumsPresent?: boolean,
  collection?: string,
  table?: string,
  extraLogInfo?: Record<string, unknown>,
}

/**
 * @internal
 */
export interface DataAPIRequestInfo {
  target: CommandEventTarget,
  command: Record<string, any>,
  timeoutManager: TimeoutManager,
  bigNumsPresent: boolean | undefined,
}

/**
 * @internal
 */
type EmissionStrategy<Kind extends ClientKind> = (logger: InternalLogger<any>) => {
  emitCommandStarted?(requestId: string, info: DataAPIRequestInfo, opts: ExecCmdOpts<Kind>): void,
  emitCommandFailed?(requestId: string, info: DataAPIRequestInfo, resp: RawDataAPIResponse | undefined, error: Error, started: number, opts: ExecCmdOpts<Kind>): void,
  emitCommandSucceeded?(requestId: string, info: DataAPIRequestInfo, resp: RawDataAPIResponse, started: number, opts: ExecCmdOpts<Kind>): void,
  emitCommandWarnings?(requestId: string, info: DataAPIRequestInfo, warnings: NonEmpty<DataAPIWarningDescriptor>, opts: ExecCmdOpts<Kind>): void,
}

/**
 * @internal
 */
interface EmissionStrategies {
  Normal: EmissionStrategy<'normal'>,
  Admin: EmissionStrategy<'admin'>,
}

/**
 * @internal
 */
export const EmissionStrategy: EmissionStrategies = {
  Normal: (logger) => ({
    emitCommandStarted(reqId, info, opts) {
      logger.commandStarted?.(reqId, info, opts.extraLogInfo);
    },
    emitCommandFailed(reqId, info, resp, error, started, opts) {
      logger.commandFailed?.(reqId, info, opts.extraLogInfo, resp, error, started);
    },
    emitCommandSucceeded(reqId, info, resp, started, opts) {
      logger.commandSucceeded?.(reqId, info, opts.extraLogInfo, resp, started);
    },
    emitCommandWarnings(reqId, info, warnings, opts) {
      logger.commandWarnings?.(reqId, info, opts.extraLogInfo, warnings);
    },
  }),
  Admin: (logger) => ({
    emitCommandStarted(reqId, info, opts) {
      logger.adminCommandStarted?.(reqId, '', adaptInfo4Devops(info, opts.methodName), true, null!); // TODO
    },
    emitCommandFailed(reqId, info, _, error, started, opts) {
      logger.adminCommandFailed?.(reqId, '', adaptInfo4Devops(info, opts.methodName), true, error, started);
    },
    emitCommandSucceeded(reqId, info, resp, started, opts) {
      logger.adminCommandSucceeded?.(reqId, '', adaptInfo4Devops(info, opts.methodName), true, resp, started);
    },
    emitCommandWarnings(reqId, info, warnings, opts) {
      logger.adminCommandWarnings?.(reqId, '', adaptInfo4Devops(info, opts.methodName), true, warnings);
    },
  }),
};

const adaptInfo4Devops = (info: DataAPIRequestInfo, methodName: DevOpsAPIRequestInfo['methodName']) => (<const>{
  method: 'POST',
  data: info.command,
  path: info.target.url,
  methodName,
});

/**
 * @internal
 */
interface DataAPIHttpClientOpts<Kind extends ClientKind> extends Omit<HTTPClientOptions, 'mkTimeoutError'> {
  keyspace: KeyspaceRef,
  emissionStrategy: EmissionStrategy<Kind>,
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
  public collectionName?: string;
  public tableName?: string;
  public keyspace: KeyspaceRef;
  public emissionStrategy: ReturnType<EmissionStrategy<Kind>>;
  public bigNumHack?: BigNumberHack;

  readonly #props: DataAPIHttpClientOpts<Kind>;

  constructor(opts: DataAPIHttpClientOpts<Kind>) {
    super('data-api', {
      ...opts,
      additionalHeaders: HeadersProvider.opts.fromObj.concat([
        opts.additionalHeaders,
        opts.tokenProvider.toHeadersProvider(),
      ]),
      mkTimeoutError: DataAPITimeoutError.mk,
    });

    this.keyspace = opts.keyspace;
    this.#props = opts;
    this.emissionStrategy = opts.emissionStrategy(opts.logger.internal);
  }

  public rm(isSafelyRetryable: boolean, opts: CommandOptions): RetryManager<DataAPIRequestInfo> {
    return RetryManager.mk(isSafelyRetryable, opts, new DataAPIRetryAdapter(this.logger), undefined);
  }

  public forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(tSlashC: Collection | Table<SomeRow>, opts: CollectionOptions | TableOptions | undefined, bigNumHack: BigNumberHack): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      emissionStrategy: EmissionStrategy.Normal,
      keyspace: { ref: tSlashC.keyspace },
      logger: tSlashC,
      additionalHeaders: HeadersProvider.opts.monoid.concat([
        this.#props.additionalHeaders,
        HeadersProvider.opts.fromStr(EmbeddingAPIKeyHeaderProvider).parse(opts?.embeddingApiKey),
        HeadersProvider.opts.fromStr(RerankingAPIKeyHeaderProvider).parse(opts?.rerankingApiKey),
      ]),
    });

    if (tSlashC instanceof Collection) {
      clone.collectionName = tSlashC.name;
    } else {
      clone.tableName = tSlashC.name;
    }

    clone.bigNumHack = bigNumHack;
    clone.tm = new Timeouts(DataAPITimeoutError.mk, Timeouts.cfg.parse({ ...this.tm.baseTimeouts, ...opts?.timeoutDefaults }));

    return clone;
  }

  public forDbAdmin(dbAdmin: DbAdmin, opts: ParsedAdminOptions): DataAPIHttpClient<'admin'> {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      tokenProvider: TokenProvider.opts.concat([opts.adminToken, this.#props.tokenProvider]),
      baseUrl: opts?.endpointUrl ?? this.#props.baseUrl,
      baseApiPath: opts?.endpointUrl ? '' : this.#props.baseApiPath,
      emissionStrategy: EmissionStrategy.Admin,
      logger: dbAdmin,
    });

    clone.collectionName = undefined;
    clone.tableName = undefined;
    clone.tm = new Timeouts(DataAPITimeoutError.mk, { ...this.tm.baseTimeouts, ...opts?.timeoutDefaults });

    return clone;
  }

  public async executeCommand(command: Record<string, any>, options: ExecCmdOpts<Kind>): Promise<RawDataAPIResponse> {
    if (options?.collection && options.table) {
      throw new Error('Can\'t provide both `table` and `collection` as options to DataAPIHttpClient.executeCommand()');
    }

    const tOrC = options.collection || options.table || this.collectionName || this.tableName;
    const keyspace = options.keyspace === undefined ? this.keyspace?.ref : options.keyspace;

    if (keyspace === undefined) {
      throw new Error('Db is missing a required keyspace; be sure to set one with client.db(..., { keyspace }), or db.useKeyspace()');
    }

    if (keyspace === null && tOrC) {
      throw new Error('Keyspace may not be `null` when a table or collection is provided to DataAPIHttpClient.executeCommand()');
    }

    const keyspacePath = keyspace ? `/${keyspace}` : '';
    const collectionPath = tOrC ? `/${tOrC}` : '';
    const url = this.baseUrl + keyspacePath + collectionPath;

    const info: DataAPIRequestInfo = {
      command: command,
      timeoutManager: options.timeoutManager,
      bigNumsPresent: options.bigNumsPresent,
      target: mkCommandEventTarget(url, keyspace, tOrC, tOrC ? (tOrC === (options.table || this.tableName) ? 'table' : 'collection') : undefined),
    };

    const requestId = this.logger.internal.generateCommandRequestId();

    this.emissionStrategy.emitCommandStarted?.(requestId, info, options);
    const started = performance.now();

    let clonedData: RawDataAPIResponse | undefined;

    try {
      const serialized = (info.bigNumsPresent)
        ? this.bigNumHack?.parser.stringify(info.command)
        : JSON.stringify(info.command);

      const resp = await this._request({
        url: info.target.url,
        data: serialized,
        timeoutManager: info.timeoutManager,
        method: HttpMethods.Post,
      });

      if (resp.status >= 400 && resp.status !== 401) {
        throw new DataAPIHttpError(resp);
      }

      const data = (resp.body)
        ? (this.bigNumHack?.parseWithBigNumbers(resp.body))
          ? this.bigNumHack?.parser.parse(resp.body)
          : JSON.parse(resp.body)
        /* c8 ignore next: exceptional case */
        : {};

      clonedData = requestId
        ? structuredClone(data)
        : undefined;

      const warnings = data?.status?.warnings ?? [];

      if (warnings.length) {
        this.emissionStrategy.emitCommandWarnings?.(requestId, info, warnings, options);
      }

      if (data.errors && isNonEmpty(data.errors)) {
        throw new DataAPIResponseError(info.command, data);
      }

      const respData = {
        data: data.data,
        status: data.status,
        errors: data.errors,
      };

      this.emissionStrategy.emitCommandSucceeded?.(requestId, info, clonedData!, started, options);
      return respData;
    } catch (thrown) {
      const err = NonErrorError.asError(thrown);
      this.emissionStrategy.emitCommandFailed?.(requestId, info, clonedData, err, started, options);
      throw err;
    }
  }
}

const mkCommandEventTarget = (url: string, keyspace: string | null, tOrC?: string, tOrCType?: 'table' | 'collection'): Readonly<CommandEventTarget> => {
  const target = { url } as CommandEventTarget;

  if (keyspace) {
    target.keyspace = keyspace;
  }

  if (tOrCType) {
    target[tOrCType] = tOrC;
  }

  return target;
};
