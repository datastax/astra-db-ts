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

import {
  DEFAULT_DATA_API_AUTH_HEADER,
  DEFAULT_NAMESPACE,
  DEFAULT_TIMEOUT, HeaderProvider,
  hrTimeMs,
  HttpClient,
  HTTPClientOptions,
  HttpMethods,
  RawDataAPIResponse,
} from '@/src/api';
import { DataAPIResponseError, DataAPITimeoutError, ObjectId, UUID } from '@/src/data-api';
import { TimeoutManager, TimeoutOptions } from '@/src/api/timeout-managers';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent } from '@/src/data-api/events';
import { CollectionNotFoundError, DataAPIHttpError, mkRespErrorFromResponse } from '@/src/data-api/errors';
import { CollectionSpawnOptions } from '@/src/data-api/types/collections/spawn-collection';
import TypedEmitter from 'typed-emitter';
import { DataAPIClientEvents } from '@/src/client';
import {
  AdminCommandFailedEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminSpawnOptions,
} from '@/src/devops';
import { nullish, TokenProvider } from '@/src/common';
import { EmbeddingHeadersProvider } from '@/src/data-api/embedding-providers';

/**
 * @internal
 */
export interface DataAPIRequestInfo {
  url: string,
  collection?: string,
  namespace?: string | null,
  command: Record<string, any>,
  timeoutManager: TimeoutManager,
}

interface ExecuteCommandOptions {
  namespace?: string | null,
  collection?: string,
}

type EmissionStrategy = (emitter: TypedEmitter<DataAPIClientEvents>) => {
  emitCommandStarted(info: DataAPIRequestInfo): void,
  emitCommandFailed(info: DataAPIRequestInfo, error: Error, started: number): void,
  emitCommandSucceeded(info: DataAPIRequestInfo, resp: RawDataAPIResponse, started: number): void,
}

export const EmissionStrategy: Record<'Normal' | 'Admin', EmissionStrategy> = {
  Normal: (emitter) => ({
    emitCommandStarted(info) {
      emitter.emit('commandStarted', new CommandStartedEvent(info));
    },
    emitCommandFailed(info, error, started) {
      emitter.emit('commandFailed', new CommandFailedEvent(info, error, started));
    },
    emitCommandSucceeded(info, resp, started) {
      emitter.emit('commandSucceeded', new CommandSucceededEvent(info, resp, started));
    },
  }),
  Admin: (emitter) => ({
    emitCommandStarted(info) {
      emitter.emit('adminCommandStarted', new AdminCommandStartedEvent(adaptInfo4Devops(info), true, info.timeoutManager.msRemaining()));
    },
    emitCommandFailed(info, error, started) {
      emitter.emit('adminCommandFailed', new AdminCommandFailedEvent(adaptInfo4Devops(info), true, error, started));
    },
    emitCommandSucceeded(info, resp, started) {
      emitter.emit('adminCommandSucceeded', new AdminCommandSucceededEvent(adaptInfo4Devops(info), true, resp, started));
    },
  }),
}

const adaptInfo4Devops = (info: DataAPIRequestInfo) => (<const>{
  method: 'POST',
  data: info.command,
  params: {},
  path: info.url,
});

interface DataAPIHttpClientOpts extends HTTPClientOptions {
  namespace: string | undefined,
  emissionStrategy: EmissionStrategy,
  embeddingHeaders: EmbeddingHeadersProvider,
  tokenProvider: TokenProvider,
}

/**
 * @internal
 */
export class DataAPIHttpClient extends HttpClient {
  public collection?: string;
  public namespace?: string;
  public maxTimeMS: number;
  public emissionStrategy: ReturnType<EmissionStrategy>
  readonly #props: DataAPIHttpClientOpts;

  constructor(props: DataAPIHttpClientOpts) {
    super(props, [mkAuthHeaderProvider(props.tokenProvider), props.embeddingHeaders.getHeaders]);
    this.namespace = 'namespace' in props ? props.namespace : DEFAULT_NAMESPACE;
    this.#props = props;
    this.maxTimeMS = this.fetchCtx.maxTimeMS ?? DEFAULT_TIMEOUT;
    this.emissionStrategy = props.emissionStrategy(props.emitter);
  }

  public forCollection(namespace: string, collection: string, opts: CollectionSpawnOptions | undefined): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      embeddingHeaders: EmbeddingHeadersProvider.parseHeaders(opts?.embeddingApiKey),
      namespace: namespace,
    });

    clone.collection = collection;
    clone.maxTimeMS = opts?.defaultMaxTimeMS ?? this.maxTimeMS;

    return clone;
  }

  public forDbAdmin(opts: AdminSpawnOptions | undefined): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      tokenProvider: opts?.adminToken ? TokenProvider.parseToken(opts?.adminToken) : this.#props.tokenProvider,
      monitorCommands: opts?.monitorCommands || this.#props.monitorCommands,
      baseUrl: opts?.endpointUrl || this.#props.baseUrl,
      baseApiPath: opts?.endpointUrl ? '' : this.#props.baseApiPath,
    });

    clone.emissionStrategy = EmissionStrategy.Admin(this.emitter);
    clone.collection = undefined;
    clone.namespace = undefined;

    return clone;
  }

  public timeoutManager(timeout: number | undefined) {
    timeout ??= this.maxTimeMS;
    return new TimeoutManager(timeout, () => new DataAPITimeoutError(timeout));
  }

  public async executeCommand(command: Record<string, any>, options: TimeoutOptions & ExecuteCommandOptions | undefined) {
    const timeoutManager = options?.timeoutManager ?? this.timeoutManager(options?.maxTimeMS);

    return await this._requestDataAPI({
      url: this.baseUrl,
      timeoutManager: timeoutManager,
      collection: options?.collection,
      namespace: options?.namespace,
      command: command,
    });
  }

  private async _requestDataAPI(info: DataAPIRequestInfo): Promise<RawDataAPIResponse> {
    let started = 0;

    try {
      info.collection ||= this.collection;

      if (info.namespace !== null) {
        info.namespace ||= this.namespace;
      }

      const keyspacePath = info.namespace ? `/${info.namespace}` : '';
      const collectionPath = info.collection ? `/${info.collection}` : '';
      info.url += keyspacePath + collectionPath;

      if (this.monitorCommands) {
        started = hrTimeMs();
        this.emissionStrategy.emitCommandStarted(info);
      }

      const resp = await this._request({
        url: info.url,
        data: JSON.stringify(info.command, replacer),
        timeoutManager: info.timeoutManager,
        method: HttpMethods.Post,
      });

      if (resp.status >= 400 && resp.status !== 401) {
        throw new DataAPIHttpError(resp);
      }

      const data: RawDataAPIResponse = resp.body ? JSON.parse(resp.body, reviver) : {};

      if (resp.status === 401 || (data.errors && data.errors.length > 0 && data.errors[0]?.message === 'UNAUTHENTICATED: Invalid token')) {
        const fauxResponse = mkFauxErroredResponse('Authentication failed; is your token valid?');
        throw mkRespErrorFromResponse(DataAPIResponseError, info.command, fauxResponse);
      }

      if (data.errors && data.errors.length > 0 && data.errors[0]?.errorCode === 'COLLECTION_NOT_EXIST') {
        const name = data.errors[0]?.message.split(': ')[1];
        throw new CollectionNotFoundError(info.namespace ?? '<unknown>', name);
      }

      if (data.errors && data.errors.length > 0) {
        throw mkRespErrorFromResponse(DataAPIResponseError, info.command, data);
      }

      const respData = {
        data: data.data,
        status: data.status,
        errors: data.errors,
      }

      if (this.monitorCommands) {
        this.emissionStrategy.emitCommandSucceeded(info, respData, started);
      }

      return respData;
    } catch (e: any) {
      if (this.monitorCommands) {
        this.emissionStrategy.emitCommandFailed(info, e, started);
      }
      throw e;
    }
  }
}

const mkFauxErroredResponse = (message: string): RawDataAPIResponse => {
  return { errors: [{ message }] };
}

/**
 * @internal
 */
export function replacer(this: any, key: string, value: any): any {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof this[key] === 'object') {
    if (key === '$date') {
      return new Date(value).valueOf();
    }

    if (this[key] instanceof Date) {
      return { $date: this[key].valueOf() };
    }
  }

  return value;
}

/**
 * @internal
 */
export function reviver(_: string, value: any): any {
  if (!value) {
    return value;
  }
  if (value.$date) {
    return new Date(value.$date);
  }
  if (value.$objectId) {
    return new ObjectId(value.$objectId);
  }
  if (value.$uuid) {
    return new UUID(value.$uuid);
  }
  return value;
}

const mkAuthHeaderProvider = (tp: TokenProvider): HeaderProvider => () => {
  const token = tp.getToken();

  return (token instanceof Promise)
    ? token.then(mkAuthHeader)
    : mkAuthHeader(token);
}

const mkAuthHeader = (token: string | nullish): Record<string, string> => (token)
  ? { [DEFAULT_DATA_API_AUTH_HEADER]: `Bearer ${token}` }
  : {};
