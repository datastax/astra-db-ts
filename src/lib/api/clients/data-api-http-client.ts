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

import { Logger } from '@/src/lib/logging/logger.js';
import type { HierarchicalEmitter, nullish, RawDataAPIResponse } from '@/src/lib/index.js';
import { TokenProvider } from '@/src/lib/index.js';
import type { CommandEventTarget, DataAPIErrorDescriptor, SomeDoc, SomeRow, Table } from '@/src/documents/index.js';
import {
  Collection,
  DataAPIHttpError,
  DataAPIResponseError,
  DataAPITimeoutError,
  EmbeddingHeadersProvider,
} from '@/src/documents/index.js';
import type { HeaderProvider, HTTPClientOptions, KeyspaceRef } from '@/src/lib/api/clients/types.js';
import { HttpClient } from '@/src/lib/api/clients/http-client.js';
import { DEFAULT_DATA_API_AUTH_HEADER, HttpMethods } from '@/src/lib/api/constants.js';
import type { CollectionOptions, TableOptions } from '@/src/db/index.js';
import { mkRespErrorFromResponse } from '@/src/documents/errors.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { EmptyObj } from '@/src/lib/types.js';
import type { ParsedAdminOptions } from '@/src/client/opts-handlers/admin-opts-handler.js';
import type { ParsedTokenProvider } from '@/src/lib/token-providers/token-provider.js';
import type { AdminCommandEventMap } from '@/src/administration/index.js';

type ClientKind = 'admin' | 'normal';

/**
 * @internal
 */
type ExecCmdOpts<Kind extends ClientKind> = (Kind extends 'admin' ? { methodName: string } : EmptyObj) & {
  keyspace?: string | null,
  timeoutManager: TimeoutManager,
  bigNumsPresent?: boolean,
  collection?: string,
  table?: string,
}

/**
 * @internal
 */
export interface DataAPIRequestInfo {
  url: string,
  collection: string | undefined,
  keyspace: string | null,
  command: Record<string, any>,
  timeoutManager: TimeoutManager,
  bigNumsPresent: boolean | undefined,
  target: CommandEventTarget,
}

/**
 * @internal
 */
type EmissionStrategy<Kind extends ClientKind> = (logger: Logger) => {
  emitCommandStarted?(requestId: string, info: DataAPIRequestInfo, opts: ExecCmdOpts<Kind>): void,
  emitCommandFailed?(requestId: string, info: DataAPIRequestInfo, error: Error, started: number, opts: ExecCmdOpts<Kind>): void,
  emitCommandSucceeded?(requestId: string, info: DataAPIRequestInfo, resp: RawDataAPIResponse, started: number, opts: ExecCmdOpts<Kind>): void,
  emitCommandWarnings?(requestId: string, info: DataAPIRequestInfo, warnings: DataAPIErrorDescriptor[], opts: ExecCmdOpts<Kind>): void,
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
    emitCommandStarted: logger.commandStarted,
    emitCommandFailed: logger.commandFailed,
    emitCommandSucceeded: logger.commandSucceeded,
    emitCommandWarnings: logger.commandWarnings,
  }),
  Admin: (logger) => ({
    emitCommandStarted(reqId, info, opts) {
      logger.adminCommandStarted?.(reqId, adaptInfo4Devops(info, opts.methodName), true, null!); // TODO
    },
    emitCommandFailed(reqId, info, error, started, opts) {
      logger.adminCommandFailed?.(reqId, adaptInfo4Devops(info, opts.methodName), true, error, started);
    },
    emitCommandSucceeded(reqId, info, resp, started, opts) {
      logger.adminCommandSucceeded?.(reqId, adaptInfo4Devops(info, opts.methodName), true, resp, started);
    },
    emitCommandWarnings(reqId, info, warnings, opts) {
      logger.adminCommandWarnings?.(reqId, adaptInfo4Devops(info, opts.methodName), true, warnings);
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
    super(opts, [mkAuthHeaderProvider(opts.tokenProvider), () => opts.embeddingHeaders.getHeaders()], DataAPITimeoutError.mk);
    this.keyspace = opts.keyspace;
    this.#props = opts;
    this.emissionStrategy = opts.emissionStrategy(this.logger);
  }

  public forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(thing: Collection | Table<SomeRow>, opts: CollectionOptions | TableOptions | undefined, bigNumHack: BigNumberHack): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      embeddingHeaders: EmbeddingHeadersProvider.parse(opts?.embeddingApiKey),
      logging: Logger.cfg.concatParseWithin([this.#props.logging], opts, 'logging'),
      emissionStrategy: EmissionStrategy.Normal,
      keyspace: { ref: thing.keyspace },
      emitter: thing,
    });

    if (thing instanceof Collection) {
      clone.collectionName = thing.name;
    } else {
      clone.tableName = thing.name;
    }
    
    clone.bigNumHack = bigNumHack;
    clone.tm = new Timeouts(DataAPITimeoutError.mk, Timeouts.cfg.parse({ ...this.tm.baseTimeouts, ...opts?.timeoutDefaults }));

    return clone;
  }

  public forDbAdmin(emitter: HierarchicalEmitter<AdminCommandEventMap>, opts: ParsedAdminOptions): DataAPIHttpClient<'admin'> {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      tokenProvider: TokenProvider.opts.concat([opts.adminToken, this.#props.tokenProvider]),
      logging: Logger.cfg.concat([this.#props.logging, opts.logging]),
      baseUrl: opts?.endpointUrl ?? this.#props.baseUrl,
      baseApiPath: opts?.endpointUrl ? '' : this.#props.baseApiPath,
      additionalHeaders: { ...this.#props.additionalHeaders, ...opts?.additionalHeaders },
      emissionStrategy: EmissionStrategy.Admin,
      emitter: emitter,
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

    const collection = options.collection || options.table || this.collectionName || this.tableName;
    const keyspace = options.keyspace === undefined ? this.keyspace?.ref : options.keyspace;

    if (keyspace === undefined) {
      throw new Error('Db is missing a required keyspace; be sure to set one with client.db(..., { keyspace }), or db.useKeyspace()');
    }

    if (keyspace === null && collection) {
      throw new Error('Keyspace may not be `null` when a table or collection is provided to DataAPIHttpClient.executeCommand()');
    }

    const target =
      (options.collection || this.collectionName)
        ? 'collection' :
      (options.table || this.tableName)
        ? 'table' :
      (keyspace)
        ? 'keyspace'
        : 'database';

    const info: DataAPIRequestInfo = {
      url: this.baseUrl,
      collection: collection,
      keyspace: keyspace,
      command: command,
      timeoutManager: options.timeoutManager,
      bigNumsPresent: options.bigNumsPresent,
      target: target,
    };

    const keyspacePath = info.keyspace ? `/${info.keyspace}` : '';
    const collectionPath = info.collection ? `/${info.collection}` : '';
    info.url += keyspacePath + collectionPath;

    const requestId = this.logger.generateAdminCommandRequestId();

    this.emissionStrategy.emitCommandStarted?.(requestId, info, options);
    const started = performance.now();

    try {
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
        this.emissionStrategy.emitCommandWarnings?.(requestId, info, warnings, options);
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

      this.emissionStrategy.emitCommandSucceeded?.(requestId, info, respData, started, options);
      return respData;
    } catch (e: any) {
      this.emissionStrategy.emitCommandFailed?.(requestId, info, e, started, options);
      throw e;
    }
  }
}

const mkAuthHeaderProvider = (tp: ParsedTokenProvider): HeaderProvider => () => {
  const token = tp.getToken();

  return (token instanceof Promise)
    ? token.then(mkAuthHeader)
    : mkAuthHeader(token);
};

const mkAuthHeader = (token: string | nullish): Record<string, string> => (token)
  ? { [DEFAULT_DATA_API_AUTH_HEADER]: token }
  : {};
