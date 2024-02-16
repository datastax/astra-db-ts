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

import url from 'url';
import { logger } from '@/src/logger';
import { handleIfErrorResponse, HTTPClient } from '@/src/client/httpClient';
import { ObjectId } from 'bson';

interface ParsedUri {
  baseUrl: string;
  baseApiPath: string;
  keyspaceName: string;
  applicationToken: string;
  logLevel: string;
}

// Parse a connection URI in the format of: https://${baseUrl}/${baseAPIPath}/${keyspace}?applicationToken=${applicationToken}
export const parseUri = (uri: string): ParsedUri => {
  const parsedUrl = url.parse(uri, true);

  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

  const keyspaceName = parsedUrl.pathname?.substring(
    parsedUrl.pathname?.lastIndexOf("/") + 1,
  );

  const baseApiPath = getBaseAPIPath(parsedUrl.pathname);

  const applicationToken = parsedUrl.query?.applicationToken as string;

  const logLevel = parsedUrl.query?.logLevel as string;

  if (!keyspaceName) {
    throw new Error("Invalid URI: keyspace is required");
  }

  return {
    baseUrl,
    baseApiPath,
    keyspaceName,
    applicationToken,
    logLevel,
  };
};

// Removes the last part of the api path (which is assumed as the keyspace name). for example below are the sample input => output from this function
// /v1/testks1 => v1
// /apis/v1/testks1 => apis/v1
// /testks1 => '' (empty string)
function getBaseAPIPath(pathFromUrl?: string | null) {
  if (!pathFromUrl) {
    return "";
  }
  const pathElements = pathFromUrl.split("/");
  pathElements[pathElements.length - 1] = "";
  const baseApiPath = pathElements.join("/");
  return baseApiPath === "/"
    ? ""
    : baseApiPath.substring(1, baseApiPath.length - 1);
}

// Get the keyspace name from the path
export function getKeyspaceName(pathFromUrl?: string | null) {
  if (!pathFromUrl) {
    return "";
  }
  const pathElements = pathFromUrl.split("/");
  return pathElements[pathElements.length - 1];
}

/**
 * Create an Astra connection URI while connecting to Astra JSON API
 * @param apiEndPoint the API EndPoint of the Astra database
 * @param keyspace the keyspace to connect to
 * @param applicationToken an Astra application token
 * @param baseApiPath baseAPI path defaults to /api/json/v1
 * @param logLevel an winston log level (error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6)
 * @returns URL as string
 */
export function createAstraUri(
  apiEndPoint: string,
  keyspace: string,
  applicationToken?: string,
  baseApiPath?: string,
  logLevel?: string,
) {
  const uri = new url.URL(apiEndPoint);

  let contextPath = "";
  contextPath += baseApiPath ? `/${baseApiPath}` : "/api/json/v1";
  contextPath += `/${keyspace}`;

  uri.pathname = contextPath;

  if (applicationToken) {
    uri.searchParams.append("applicationToken", applicationToken);
  }

  if (logLevel) {
    uri.searchParams.append("logLevel", logLevel);
  }

  return uri.toString();
}

export const executeOperation = async (operation: () => Promise<unknown>) => {
  let res: any = {};

  try {
    res = await operation();
  } catch (e: any) {
    logger.error(e?.stack || e?.message);
    throw e;
  }

  return res;
};

export async function createNamespace(httpClient: HTTPClient, name: string) {
  const data = {
    createNamespace: {
      name,
    },
  };

  parseUri(httpClient.baseUrl);
  const response = await httpClient.request({
    url: httpClient.baseUrl,
    method: "POST",
    data,
  });

  handleIfErrorResponse(response, data);
  return response;
}

export async function dropNamespace(httpClient: HTTPClient, name: string) {
  const data = {
    dropNamespace: {
      name,
    },
  };

  const response = await httpClient.request({
    url: httpClient.baseUrl,
    method: "POST",
    data,
  });

  handleIfErrorResponse(response, data);
  return response;
}

export function setDefaultIdForUpsert(
  command: Record<string, any>,
  replace?: boolean,
) {
  if (!command.filter || "_id" in command.filter) {
    return;
  }

  if (!command.options || !command.options.upsert) {
    return;
  }

  if (replace) {
    if (command.replacement != null && "_id" in command.replacement) {
      return;
    }

    command.replacement ??= {};
    command.replacement._id = genObjectId();

    return;
  }

  if (command.update != null && _updateHasKey(command.update, "_id")) {
    return;
  }

  command.update ??= {};
  command.update.$setOnInsert ??= {};

  if (!("_id" in command.update.$setOnInsert)) {
    command.update.$setOnInsert._id = genObjectId();
  }
}

function genObjectId() {
  return new ObjectId().toString();
}

function _updateHasKey(update: Record<string, any>, key: string) {
  for (const operator of Object.keys(update)) {
    if (
      update[operator] != null &&
      typeof update[operator] === "object" &&
      key in update[operator]
    ) {
      return true;
    }
  }
  return false;
}
