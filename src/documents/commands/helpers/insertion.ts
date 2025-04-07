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

import type { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import type { CollectionInsertManyError, TableInsertManyError } from '@/src/documents/errors.js';
import { DataAPIResponseError } from '@/src/documents/errors.js';
import type { SomeDoc, SomeId, SomeRow } from '@/src/documents/index.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import type { GenericInsertManyDocumentResponse } from '@/src/documents/commands/types/insert/insert-many.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';
import { isNonEmpty } from '@/src/lib/utils.js';

/**
 * @internal
 */
export type InsertManyErrorConstructor = typeof TableInsertManyError | typeof CollectionInsertManyError;

/**
 * @internal
 */
export const insertManyOrdered = async <ID>(
  httpClient: DataAPIHttpClient,
  serdes: SerDes,
  documents: readonly SomeDoc[],
  chunkSize: number,
  timeoutManager: TimeoutManager,
  err: InsertManyErrorConstructor,
): Promise<ID[]> => {
  const insertedIds: ID[] = [];

  for (let i = 0, n = documents.length; i < n; i += chunkSize) {
    const slice = documents.slice(i, i + chunkSize);

    const extraLogInfo = (documents.length === slice.length)
      ? { records: documents.length, ordered: true }
      : { records: documents.length, slice: `${i}..${i + slice.length}`, ordered: true };

    const resp = await insertMany<ID>(httpClient, serdes, slice, true, timeoutManager, extraLogInfo);
    insertedIds.push(...resp.insertedIds);

    if (resp.error) {
      throw new err([resp.error], {
        insertedIds: insertedIds as (SomeRow[] & SomeId[]),
        insertedCount: insertedIds.length,
      });
    }
  }

  return insertedIds;
};

/**
 * @internal
 */
export const insertManyUnordered = async <ID>(
  httpClient: DataAPIHttpClient,
  serdes: SerDes,
  documents: readonly SomeDoc[],
  concurrency: number,
  chunkSize: number,
  timeoutManager: TimeoutManager,
  err: InsertManyErrorConstructor,
): Promise<ID[]> => {
  const insertedIds: ID[] = [];
  let masterIndex = 0;

  const docResps = [] as GenericInsertManyDocumentResponse<SomeDoc>[];
  const errors = [] as DataAPIResponseError[];

  const promises = Array.from({ length: concurrency }, async () => {
    while (masterIndex < documents.length) {
      const localI = masterIndex;
      const endIdx = Math.min(localI + chunkSize, documents.length);
      masterIndex += chunkSize;

      const slice = documents.slice(localI, endIdx);

      const extraLogInfo = (documents.length === slice.length)
        ? { records: documents.length, ordered: false }
        : { records: documents.length, slice: `${localI}..${endIdx}`, ordered: false };

      const resp = await insertMany<ID>(httpClient, serdes, slice, false, timeoutManager, extraLogInfo);
      insertedIds.push(...resp.insertedIds);
      docResps.push(...resp.documentResponses);

      if (resp.error) {
        errors.push(resp.error);
      }
    }
  });
  await Promise.all(promises);

  if (isNonEmpty(errors)) {
    throw new err(errors, {
      insertedIds: insertedIds as (SomeRow[] & SomeId[]),
      insertedCount: insertedIds.length,
    });
  }

  return insertedIds;
};

interface InsertManyResult<ID> {
  readonly documentResponses: GenericInsertManyDocumentResponse<ID>[],
  readonly insertedIds: ID[],
  readonly error?: DataAPIResponseError,
}

const insertMany = async <ID>(
  httpClient: DataAPIHttpClient,
  serdes: SerDes,
  documents: readonly SomeDoc[],
  ordered: boolean,
  timeoutManager: TimeoutManager,
  extraLogInfo: Record<string, unknown>,
): Promise<InsertManyResult<ID>> => {
  let raw, err: DataAPIResponseError | undefined;

  try {
    const serialized = [];
    let bigNumsPresent = false;

    for (let i = 0, n = documents.length; i < n; i++) {
      const resp = serdes.serialize(documents[i], SerDesTarget.Record);
      serialized.push(resp[0]);
      bigNumsPresent ||= resp[1];
    }

    raw = await httpClient.executeCommand({
      insertMany: {
        documents: serialized,
        options: {
          returnDocumentResponses: true,
          ordered,
        },
      },
    }, { timeoutManager, bigNumsPresent, extraLogInfo: extraLogInfo });
  } catch (e) {
    if (!(e instanceof DataAPIResponseError)) {
      throw e;
    }
    raw = e.rawResponse;
    err = e;
  }

  /* c8 ignore next: don't think it's possible for documentResponses to be null, but just in case */
  const documentResponses = raw.status?.documentResponses ?? [];
  const errors = raw.errors;

  const insertedIds: ID[] = [];

  for (let i = 0, n = documentResponses.length; i < n; i++) {
    const response = documentResponses[i];

    if (response.status === "OK") {
      insertedIds.push(serdes.deserialize(response._id, raw, SerDesTarget.InsertedId));
    } else if ('errorsIdx' in response) {
      response.error = errors![response.errorsIdx];
      delete response.errorsIdx;
    }
  }

  return {
    documentResponses,
    insertedIds,
    error: err,
  };
};
