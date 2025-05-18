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
import type {
  DataAPIClientEventMap, EmptyObj,
  NonEmpty,
  nullish,
  RawDataAPIResponse,
  TimedOutCategories,
} from '@/src/lib/index.js';
import {
  EmbeddingAPIKeyHeaderProvider,
  HeadersProvider,
  RerankingAPIKeyHeaderProvider,
  TokenProvider,
} from '@/src/lib/index.js';
import type { CommandEventTarget, DataAPIWarningDescriptor, SomeDoc, SomeRow, Table } from '@/src/documents/index.js';
import { Collection, DataAPIHttpError, DataAPIResponseError, DataAPITimeoutError } from '@/src/documents/index.js';
import type { KeyspaceRef } from '@/src/lib/api/clients/types.js';
import type {
  BaseExecuteOperationOptions,
  BaseHTTPClientOptions,
  BaseRequestMetadata,
  HTTPRequestInfo,
} from '@/src/lib/api/clients/impls/base-http-client.js';
import { BaseHttpClient } from '@/src/lib/api/clients/impls/base-http-client.js';
import { HttpMethods } from '@/src/lib/api/constants.js';
import type { CollectionOptions, TableOptions } from '@/src/db/index.js';
import type { TimeoutAdapter } from '@/src/lib/api/timeouts/timeouts.js';
import type { ParsedAdminOptions } from '@/src/client/opts-handlers/admin-opts-handler.js';
import type { DbAdmin } from '@/src/administration/index.js';
import { NonErrorError } from '@/src/lib/errors.js';
import { isNonEmpty, isNullish } from '@/src/lib/utils.js';
import { DataAPIRetryAdapter } from '@/src/lib/api/retries/adapters/data-api.js';
import type { HeadersResolverAdapter } from '@/src/lib/api/clients/utils/headers-resolver.js';
import type { DevOpsAPIRequestMetadata, ExecuteDevOpsAPIOperationOptions } from '@/src/lib/api/clients/index.js';

/**
 * @internal
 */
type ClientKind = 'admin' | 'normal';

/**
 * @internal
 */
export interface DataAPIHttpClientOpts<Kind extends ClientKind> extends BaseHTTPClientOptions {
  keyspace: KeyspaceRef,
  emissionStrategy: EmissionStrategy<Kind>,
  collection?: string,
  table?: string,
  bigNumHack?: BigNumberHack,
}

/**
 * @internal
 */
export type ExecuteDataAPICommandOptions<Kind extends ClientKind> = BaseExecuteOperationOptions & (Kind extends 'admin' ? { methodName: ExecuteDevOpsAPIOperationOptions['methodName'] } : EmptyObj) & {
  keyspace?: string | null,
  bigNumsPresent?: boolean,
  collection?: string,
  table?: string,
  extraLogInfo?: Record<string, unknown>,
}

/**
 * @internal
 */
export interface DataAPIRequestMetadata extends BaseRequestMetadata {
  target: CommandEventTarget,
  command: Record<string, any>,
  extra?: Record<string, unknown>,
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
export class DataAPIHttpClient<Kind extends ClientKind = 'normal'> extends BaseHttpClient<DataAPIRequestMetadata> {
  public target: InternalRequestTarget;
  public emissionStrategy: ReturnType<EmissionStrategy<Kind>>;
  public bigNumHack?: BigNumberHack;

  readonly #baseOpts: DataAPIHttpClientOpts<Kind>;

  constructor(opts: DataAPIHttpClientOpts<Kind>) {
    super(opts, {
      retryAdapter: new DataAPIRetryAdapter(opts.logger),
      headersResolverAdapter: DataAPIHeadersResolverAdapter,
      timeoutAdapter: DataAPITimeoutAdapter,
    });

    this.target = new InternalRequestTarget(opts);
    this.emissionStrategy = opts.emissionStrategy(opts.logger.internal, this._baseUrl);
    this.bigNumHack = opts.bigNumHack;
    this.#baseOpts = opts;
  }

  public forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(tSlashC: Collection | Table<SomeRow>, opts: CollectionOptions | TableOptions | undefined, bigNumHack: BigNumberHack): DataAPIHttpClient {
    return new DataAPIHttpClient({
      ...this.#baseOpts,
      emissionStrategy: EmissionStrategy.Normal,
      keyspace: { ref: tSlashC.keyspace },
      logger: tSlashC,
      additionalHeaders: HeadersProvider.opts.monoid.concat([
        this.#baseOpts.additionalHeaders,
        HeadersProvider.opts.fromStr(EmbeddingAPIKeyHeaderProvider).parse(opts?.embeddingApiKey),
        HeadersProvider.opts.fromStr(RerankingAPIKeyHeaderProvider).parse(opts?.rerankingApiKey),
      ]),
      timeoutDefaults: {
        ...this.#baseOpts.timeoutDefaults,
        ...opts?.timeoutDefaults,
      },
      collection: tSlashC instanceof Collection ? tSlashC.name : undefined,
      table: tSlashC instanceof Collection ? undefined : tSlashC.name,
      bigNumHack,
    });
  }

  public forDbAdmin(dbAdmin: DbAdmin, opts: ParsedAdminOptions): DataAPIHttpClient<'admin'> {
    return new DataAPIHttpClient({
      ...this.#baseOpts,
      tokenProvider: TokenProvider.opts.concat([opts.adminToken, this.#baseOpts.tokenProvider]),
      baseUrl: opts?.endpointUrl ?? this.#baseOpts.baseUrl,
      emissionStrategy: EmissionStrategy.Admin,
      logger: dbAdmin,
      timeoutDefaults: {
        ...this.#baseOpts.timeoutDefaults,
        ...opts?.timeoutDefaults,
      },
      collection: undefined,
      table: undefined,
    });
  }

  public async executeCommand(command: Record<string, any>, opts: ExecuteDataAPICommandOptions<Kind>): Promise<RawDataAPIResponse> {
    const metadata = this._mkRequestMetadata(opts.timeoutManager, {
      target: this.target.forRequest(opts),
      extra: opts.extraLogInfo,
      command: command,
    });

    this.emissionStrategy.emitCommandStarted(metadata, opts);

    let clonedData: RawDataAPIResponse | undefined;

    try {
      const serialized = (opts.bigNumsPresent)
        ? this.bigNumHack?.parser.stringify(metadata.command)
        : JSON.stringify(metadata.command);

      const resp = await this._request({
        url: metadata.target.url,
        data: serialized,
        timeoutManager: opts.timeoutManager,
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

      clonedData = structuredClone(data);

      const warnings = data?.status?.warnings ?? [];

      if (warnings.length) {
        this.emissionStrategy.emitCommandWarnings(metadata, warnings, opts);
      }

      if (data.errors && isNonEmpty(data.errors)) {
        throw new DataAPIResponseError(metadata.command, data);
      }

      const respData = {
        data: data.data,
        status: data.status,
        errors: data.errors,
      };

      this.emissionStrategy.emitCommandSucceeded(metadata, clonedData!, opts);
      return respData;
    } catch (thrown) {
      const err = NonErrorError.asError(thrown);
      this.emissionStrategy.emitCommandFailed(metadata, clonedData, err, opts);
      throw err;
    }
  }
}

/**
 * @internal
 */
class InternalRequestTarget {
  private _cached: CommandEventTarget;

  private readonly _baseUrl: string;
  private readonly _keyspace: KeyspaceRef;

  constructor(opts: DataAPIHttpClientOpts<ClientKind>) {
    this._baseUrl = opts.baseUrl;
    this._keyspace = opts.keyspace;
    this._cached = this._buildCommandEventTarget(this._keyspace.ref, opts.collection, opts.table);
  }

  public forRequest(opts: ExecuteDataAPICommandOptions<ClientKind>): Readonly<CommandEventTarget> {
    this._rebuildCacheIfKeyspaceChanged();

    const keyspace = opts.keyspace === undefined ? this._cached.keyspace : opts.keyspace;

    if (keyspace === undefined) {
      throw new Error('Db is missing a working keyspace; set one with client.db(..., { keyspace }) or db.useKeyspace()');
    }

    if (keyspace === this._cached.keyspace) {
      if ((!opts.collection && !opts.table) || (opts.collection === this._cached.collection && opts.table === this._cached.table)) {
        return this._cached;
      }
    }

    return this._buildCommandEventTarget(keyspace, opts.collection, opts.table);
  }

  private _buildCommandEventTarget(keyspace: string | nullish, coll: string | undefined, table: string | undefined) {
    if (coll && table) {
      throw new Error('Can\'t provide both `table` and `collection` as options to DataAPIHttpClient.executeCommand()');
    }

    const tOrC = coll || table || this._cached?.collection || this._cached?.table;

    const keyspacePath = keyspace ? `/${keyspace}` : '';
    const collectionPath = tOrC ? `/${tOrC}` : '';

    const target = {
      url: this._baseUrl + keyspacePath + collectionPath,
    } as CommandEventTarget;

    if (!isNullish(keyspace)) {
      target.keyspace = keyspace;

      if (tOrC) {
        if (tOrC === coll || tOrC === this._cached?.collection) {
          target.collection = tOrC;
        } else {
          target.table = tOrC;
        }
      }
    } else if (tOrC) {
      throw new Error('Keyspace may not be `null` when a table or collection is provided to DataAPIHttpClient.executeCommand()');
    }

    return target;
  }

  private _rebuildCacheIfKeyspaceChanged() {
    if (this._keyspace.ref !== this._cached.keyspace) {
      this._cached = this._buildCommandEventTarget(this._keyspace.ref, this._cached.collection, this._cached.table);
    }
  }
}

/**
 * @internal
 */
const DataAPIHeadersResolverAdapter: HeadersResolverAdapter = {
  target: 'data-api',
};

/**
 * @internal
 */
const DataAPITimeoutAdapter: TimeoutAdapter = {
  mkTimeoutError(info: HTTPRequestInfo, categories: TimedOutCategories): Error {
    return new DataAPITimeoutError(info, categories);
  },
};

/**
 * @internal
 */
type EmissionStrategy<Kind extends ClientKind> = (logger: InternalLogger<DataAPIClientEventMap>, baseUrl: string) => {
  emitCommandStarted(info: DataAPIRequestMetadata, opts: ExecuteDataAPICommandOptions<Kind>): void,
  emitCommandFailed(info: DataAPIRequestMetadata, resp: RawDataAPIResponse | undefined, error: Error, opts: ExecuteDataAPICommandOptions<Kind>): void,
  emitCommandSucceeded(info: DataAPIRequestMetadata, resp: RawDataAPIResponse, opts: ExecuteDataAPICommandOptions<Kind>): void,
  emitCommandWarnings(info: DataAPIRequestMetadata, warnings: NonEmpty<DataAPIWarningDescriptor>, opts: ExecuteDataAPICommandOptions<Kind>): void,
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
    emitCommandStarted(metadata) {
      logger.commandStarted?.(metadata);
    },
    emitCommandFailed(metadata, resp, error) {
      logger.commandFailed?.(metadata, resp, error);
    },
    emitCommandSucceeded(metadata, resp) {
      logger.commandSucceeded?.(metadata, resp);
    },
    emitCommandWarnings(metadata, warnings) {
      logger.commandWarnings?.(metadata, warnings);
    },
  }),
  Admin: (logger, baseUrl) => ({
    emitCommandStarted(metadata, opts) {
      logger.adminCommandStarted?.(adaptInfo4Devops(baseUrl, metadata, opts));
    },
    emitCommandFailed(metadata, _, error, opts) {
      logger.adminCommandFailed?.(adaptInfo4Devops(baseUrl, metadata, opts), error);
    },
    emitCommandSucceeded(metadata, resp, opts) {
      logger.adminCommandSucceeded?.(adaptInfo4Devops(baseUrl, metadata, opts), resp);
    },
    emitCommandWarnings(metadata, warnings, opts) {
      logger.adminCommandWarnings?.(adaptInfo4Devops(baseUrl, metadata, opts), warnings);
    },
  }),
};

const adaptInfo4Devops = (baseUrl: string, metadata: DataAPIRequestMetadata, opts: ExecuteDataAPICommandOptions<'admin'>): DevOpsAPIRequestMetadata => <const>{
  timeout: metadata.timeout,
  requestId: metadata.requestId,
  startTime: metadata.startTime,
  baseUrl: baseUrl,
  isLongRunning: false,
  methodName: opts.methodName,
  reqOpts: {
    timeoutManager: opts.timeoutManager,
    data: metadata.command,
    path: metadata.target.url.replace(baseUrl, ''),
    method: HttpMethods.Post,
    methodName: opts.methodName,
  },
};
