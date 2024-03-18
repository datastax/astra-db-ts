import { HTTPClient, serializeCommand } from '@/src/api/http-client';
import { BaseOptions } from '@/src/client/types/common';
import { DEFAULT_NAMESPACE, DEFAULT_TIMEOUT, HTTP_METHODS } from '@/src/api/constants';
import { DataAPIResponseError, mkRespErrorFromResponse } from '@/src/client/errors';
import { logger } from '@/src/logger';
import { APIResponse } from '@/src/api/types';
import { EJSON } from 'bson';

interface DataApiRequestInfo {
  url: string;
  timeout?: number;
  collection?: string;
  command: Record<string, any>;
}

export class DataApiHttpClient extends HTTPClient {
  collection?: string;
  namespace?: string;

  async executeCommand(command: Record<string, any>, options?: BaseOptions & { collection?: string }, optionsToRetain?: Set<string>) {
    const commandName = Object.keys(command)[0];

    if (command[commandName].options && optionsToRetain) {
      command[commandName].options = cleanupOptions(command, commandName, optionsToRetain, this.logSkippedOptions);
    }

    const response = await this._requestDataApi({
      url: this.baseUrl,
      timeout: options?.maxTimeMS ?? DEFAULT_TIMEOUT,
      collection: options?.collection,
      command: command,
    });

    handleIfErrorResponse(response, command);
    return response;
  }

  protected async _requestDataApi(info: DataApiRequestInfo): Promise<APIResponse> {
    try {
      info.collection ||= this.collection;

      const keyspacePath = `/${this.namespace ?? DEFAULT_NAMESPACE}`;
      const collectionPath = info.collection ? `/${info.collection}` : '';
      const url = info.url + keyspacePath + collectionPath;

      const response = await this._request({
        url: url,
        data: info.command,
        timeout: info.timeout || DEFAULT_TIMEOUT,
        method: HTTP_METHODS.post,
        serializer: serializeCommand,
      });

      if (response.status === 401 || (response.data?.errors?.length > 0 && response.data?.errors[0]?.message === "UNAUTHENTICATED: Invalid token")) {
        return this._mkError("Authentication failed; is your token valid?");
      }

      if (response.status === 200) {
        return {
          status: response.data?.status,
          data: deserialize(response.data?.data),
          errors: response.data?.errors,
        };
      } else {
        logger.error(info.url + ": " + response.status);
        logger.error("Data: " + JSON.stringify(info.command));
        return this._mkError();
      }
    } catch (e: any) {
      logger.error(info.url + ": " + e.message);
      logger.error("Data: " + JSON.stringify(info.command));

      if (e?.response?.data) {
        logger.error("Response Data: " + JSON.stringify(e.response.data));
      }

      throw e;
    }
  }

  private _mkError(message?: string): APIResponse {
    return (message)
      ? { errors: [{ message }] }
      : {};
  }
}

function cleanupOptions(data: Record<string, any>, commandName: string, optionsToRetain: Set<string>, logSkippedOptions: boolean) {
  const command = data[commandName];

  if (!command.options) {
    return undefined;
  }

  const options = { ...command.options };

  Object.keys(options).forEach((key) => {
    if (!optionsToRetain.has(key)) {
      if (logSkippedOptions) {
        logger.warn(`'${commandName}' does not support option '${key}'`);
      }
      delete options[key];
    }
  });

  return options;
}

function deserialize(data?: Record<string, any> | null): Record<string, any> {
  return data ? EJSON.deserialize(data) : data;
}

export function handleIfErrorResponse(response: any, command: Record<string, any>) {
  if (response.errors && response.errors.length > 0) {
    throw mkRespErrorFromResponse(DataAPIResponseError, command, response);
  }
}
