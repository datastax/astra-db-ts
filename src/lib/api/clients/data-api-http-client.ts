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

import { TimeoutManager, TimeoutOptions } from '@/src/lib/api/timeout-managers';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent } from '@/src/documents/events';
import {
  DataAPIHttpError,
  DataAPIResponseError,
  DataAPITimeoutError,
  mkRespErrorFromResponse,
} from '@/src/documents/errors';
import TypedEmitter from 'typed-emitter';
import { DataAPIClientEvents } from '@/src/client';
import {
  AdminCommandFailedEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminSpawnOptions,
} from '@/src/administration';
import { CollectionNotFoundError } from '@/src/db/errors';
import { DEFAULT_DATA_API_AUTH_HEADER, DEFAULT_TIMEOUT, HttpMethods } from '@/src/lib/api/constants';
import { WithNullableKeyspace } from '@/src/db/types/collections/collections-common';
import { RawDataAPIResponse } from '@/src/lib/api';
import { HeaderProvider, HTTPClientOptions, KeyspaceRef } from '@/src/lib/api/clients/types';
import { nullish, TokenProvider } from '@/src/lib';
import { hrTimeMs, HttpClient } from '@/src/lib/api/clients/http-client';
import { CollectionSpawnOptions } from '@/src/db';
import { isNullish } from '@/src/lib/utils';
import { EmbeddingHeadersProvider, ObjectId, UUID } from '@/src/documents';

/**
 * @internal
 */
export interface DataAPIRequestInfo {
  url: string,
  collection?: string,
  keyspace?: string | null,
  command: Record<string, any>,
  timeoutManager: TimeoutManager,
}

interface ExecuteCommandOptions extends WithNullableKeyspace {
  collection?: string,
}

type EmissionStrategy = (emitter: TypedEmitter<DataAPIClientEvents>) => {
  emitCommandStarted(info: DataAPIRequestInfo): void,
  emitCommandFailed(info: DataAPIRequestInfo, error: Error, started: number): void,
  emitCommandSucceeded(info: DataAPIRequestInfo, resp: RawDataAPIResponse, warnings: string[], started: number): void,
}

export const EmissionStrategy: Record<'Normal' | 'Admin', EmissionStrategy> = {
  Normal: (emitter) => ({
    emitCommandStarted(info) {
      emitter.emit('commandStarted', new CommandStartedEvent(info));
    },
    emitCommandFailed(info, error, started) {
      emitter.emit('commandFailed', new CommandFailedEvent(info, error, started));
    },
    emitCommandSucceeded(info, resp, warnings, started) {
      emitter.emit('commandSucceeded', new CommandSucceededEvent(info, resp, warnings, started));
    },
  }),
  Admin: (emitter) => ({
    emitCommandStarted(info) {
      emitter.emit('adminCommandStarted', new AdminCommandStartedEvent(adaptInfo4Devops(info), true, info.timeoutManager.msRemaining()));
    },
    emitCommandFailed(info, error, started) {
      emitter.emit('adminCommandFailed', new AdminCommandFailedEvent(adaptInfo4Devops(info), true, error, started));
    },
    emitCommandSucceeded(info, resp, warnings, started) {
      emitter.emit('adminCommandSucceeded', new AdminCommandSucceededEvent(adaptInfo4Devops(info), true, resp, warnings, started));
    },
  }),
};

const adaptInfo4Devops = (info: DataAPIRequestInfo) => (<const>{
  method: 'POST',
  data: info.command,
  path: info.url,
  params: {},
});

interface DataAPIHttpClientOpts extends HTTPClientOptions {
  keyspace: KeyspaceRef,
  emissionStrategy: EmissionStrategy,
  embeddingHeaders: EmbeddingHeadersProvider,
  tokenProvider: TokenProvider,
}

/**
 * @internal
 */
export class DataAPIHttpClient extends HttpClient {
  public collection?: string;
  public keyspace: KeyspaceRef;
  public maxTimeMS: number;
  public emissionStrategy: ReturnType<EmissionStrategy>;
  readonly #props: DataAPIHttpClientOpts;

  constructor(props: DataAPIHttpClientOpts) {
    super(props, [mkAuthHeaderProvider(props.tokenProvider), props.embeddingHeaders.getHeaders.bind(props.embeddingHeaders)]);
    this.keyspace = props.keyspace;
    this.#props = props;
    this.maxTimeMS = this.fetchCtx.maxTimeMS ?? DEFAULT_TIMEOUT;
    this.emissionStrategy = props.emissionStrategy(props.emitter);
  }

  public forCollection(keyspace: string, collection: string, opts: CollectionSpawnOptions | undefined): DataAPIHttpClient {
    const clone = new DataAPIHttpClient({
      ...this.#props,
      embeddingHeaders: EmbeddingHeadersProvider.parseHeaders(opts?.embeddingApiKey),
      keyspace: { ref: keyspace },
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

    return clone;
  }

  public timeoutManager(timeout: number | undefined) {
    timeout ??= this.maxTimeMS;
    return new TimeoutManager(timeout, () => new DataAPITimeoutError(timeout));
  }

  public async executeCommand(command: Record<string, any>, options: TimeoutOptions & ExecuteCommandOptions | nullish) {
    const timeoutManager = options?.timeoutManager ?? this.timeoutManager(options?.maxTimeMS);

    return await this._requestDataAPI({
      url: this.baseUrl,
      timeoutManager: timeoutManager,
      collection: options?.collection,
      keyspace: options?.keyspace,
      command: command,
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

      const warnings = data?.status?.warnings ?? [];
      delete data?.status?.warnings;

      if (data.errors && data.errors.length > 0 && data.errors[0]?.errorCode === 'COLLECTION_NOT_EXIST') {
        const name = data.errors[0]?.message.split(': ')[1];
        throw new CollectionNotFoundError(info.keyspace ?? '<unknown>', name);
      }

      if (data.errors && data.errors.length > 0) {
        throw mkRespErrorFromResponse(DataAPIResponseError, info.command, data, warnings);
      }

      const respData = {
        data: data.data,
        status: data.status,
        errors: data.errors,
      };

      if (this.monitorCommands) {
        this.emissionStrategy.emitCommandSucceeded(info, respData, warnings, started);
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
};

const mkAuthHeader = (token: string | nullish): Record<string, string> => (token)
  ? { [DEFAULT_DATA_API_AUTH_HEADER]: token }
  : {};
