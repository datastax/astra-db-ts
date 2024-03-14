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
import { ObjectId } from 'bson';
import { SomeId } from '@/src/client/types/common';

declare const __error: unique symbol;

/**
 * Represents some type-level error which forces immediate attention rather than failing @ runtime.
 * 
 * More inflexable type than `never`, and gives contextual error messages.
 * 
 * @example
 * ```
 * function unsupported(): TypeErr<'Unsupported operation'> {
 *   throw new Error('Unsupported operation');
 * }
 * 
 * // Doesn't compile with error:
 * // Type '{ [__error]: "Unsupported operation"; }' is not assignable to type 'string'"
 * const result: string = unsupported();
 * ```
 */
export type TypeErr<S> = unknown & { [__error]: S };

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

export function setDefaultIdForInsert<T extends { _id?: SomeId }>(document: T): asserts document is T & { _id: SomeId } {
  document._id ??= genObjectId();
}

export function setDefaultIdForUpsert(command: Record<string, any>, replace?: boolean) {
  if (!command.filter || "_id" in command.filter) {
    return;
  }

  if (!command.options || !command.options.upsert) {
    return;
  }

  if (replace) {
    if (command.replacement && "_id" in command.replacement) {
      return;
    }

    command.replacement ??= {};
    command.replacement._id = genObjectId();

    return;
  }

  if (command.update && fieldHasKey(command.update, "_id")) {
    return;
  }

  command.update ??= {};
  command.update.$setOnInsert ??= {};

  if (!("_id" in command.update.$setOnInsert)) {
    command.update.$setOnInsert._id = genObjectId();
  }
}

function genObjectId(): string {
  return new ObjectId().toString();
}

function fieldHasKey(update: Record<string, any>, key: string): boolean {
  return Object.keys(update).some((operator) => (
    update[operator] &&
    typeof update[operator] === 'object' &&
    key in update[operator]
  ));
}

export function withoutFields<T extends Record<string, any> | undefined>(obj: T, ...fields: string[]): T {
  if (!obj) {
    return obj;
  }

  const newObj = { ...obj };

  for (const field of fields) {
    delete newObj[field];
  }

  return newObj;
}
