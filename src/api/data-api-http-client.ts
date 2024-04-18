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
  DEFAULT_TIMEOUT,
  hrTimeMs,
  HttpClient,
  HTTPClientOptions,
  HttpMethods,
  RawDataAPIResponse,
} from '@/src/api';
import { DataAPIResponseError, DataAPITimeoutError, ObjectId, UUID, WithNamespace } from '@/src/data-api';
import { MkTimeoutError, TimeoutManager, TimeoutOptions } from '@/src/api/timeout-managers';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent } from '@/src/data-api/events';
import { CollectionNotFoundError, DataAPIHttpError, mkRespErrorFromResponse } from '@/src/data-api/errors';

/**
 * @internal
 */
export interface DataAPIRequestInfo {
  url: string;
  collection?: string;
  namespace?: string;
  command: Record<string, any>;
  timeoutManager: TimeoutManager;
}

type ExecuteCommandOptions = {
  collection?: string;
  namespace?: string;
}

/**
 * @internal
 */
export class DataAPIHttpClient extends HttpClient {
  public collection?: string;
  public namespace?: string;
  readonly #props: HTTPClientOptions & WithNamespace;

  constructor(props: HTTPClientOptions & WithNamespace) {
    super({
      ...props,
      mkAuthHeader: (token) => ({ [DEFAULT_DATA_API_AUTH_HEADER]: token }),
      fetchCtx: {
        preferred: props.fetchCtx.preferred,
        closed: props.fetchCtx.closed,
      },
    });
    this.namespace = props.namespace;
    this.#props = props;
  }

  public withCollection(namespace: string, collection: string): DataAPIHttpClient {
    const clone = new DataAPIHttpClient(this.#props);
    clone.collection = collection;
    clone.namespace = namespace;
    return clone;
  }

  public timeoutManager(timeoutMs: number | undefined) {
    return mkTimeoutManager(timeoutMs);
  }

  public async executeCommand(command: Record<string, any>, options: TimeoutOptions & ExecuteCommandOptions | undefined) {
    const timeoutManager = options?.timeoutManager ?? mkTimeoutManager(options?.maxTimeMS);

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
      info.namespace ||= this.namespace || DEFAULT_NAMESPACE;

      const keyspacePath = `/${info.namespace}`;
      const collectionPath = info.collection ? `/${info.collection}` : '';
      info.url += keyspacePath + collectionPath;

      if (this.monitorCommands) {
        started = hrTimeMs();
        this.emitter.emit('commandStarted', new CommandStartedEvent(info));
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

      const data: RawDataAPIResponse = JSON.parse(resp.body!, reviver);

      if (resp.status === 401 || (data.errors && data.errors?.length > 0 && data?.errors[0]?.message === 'UNAUTHENTICATED: Invalid token')) {
        const fauxResponse = mkFauxErroredResponse('Authentication failed; is your token valid?');
        throw mkRespErrorFromResponse(DataAPIResponseError, info.command, fauxResponse);
      }

      if (data.errors && data?.errors?.length > 0 && data?.errors[0]?.errorCode === 'COLLECTION_NOT_EXIST') {
        const name = data?.errors[0]?.message.split(': ')[1];
        throw new CollectionNotFoundError(info.namespace, name);
      }

      if (data?.errors && data?.errors.length > 0) {
        throw mkRespErrorFromResponse(DataAPIResponseError, info.command, data);
      }

      const respData = {
        status: data?.status,
        data: data?.data,
        errors: data?.errors,
      }

      if (this.monitorCommands) {
        this.emitter.emit('commandSucceeded', new CommandSucceededEvent(info, respData, started));
      }

      return respData;
    } catch (e: any) {
      if (this.monitorCommands) {
        this.emitter.emit('commandFailed', new CommandFailedEvent(info, e, started));
      }
      throw e;
    }
  }
}

const mkTimeoutManager = (maxMs: number | undefined) => {
  const timeout = maxMs ?? DEFAULT_TIMEOUT;
  return new TimeoutManager(timeout, mkTimeoutErrorMaker(timeout));
}

const mkTimeoutErrorMaker = (timeout: number): MkTimeoutError => {
  return () => new DataAPITimeoutError(timeout);
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
