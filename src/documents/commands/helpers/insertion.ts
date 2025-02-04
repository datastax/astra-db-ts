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

import type { DataAPIHttpClient } from '@/src/lib/api/clients';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des';
import type {
  DataAPIDetailedErrorDescriptor} from '@/src/documents/errors';
import {
  DataAPIResponseError,
  mkRespErrorFromResponse,
  mkRespErrorFromResponses,
} from '@/src/documents/errors';
import type { SomeDoc, SomeId } from '@/src/documents';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts';
import type { RawDataAPIResponse } from '@/src/lib';
import type { GenericInsertManyDocumentResponse } from '@/src/documents/commands/types/insert/insert-many';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx';

/**
 * @internal
 */
export const insertManyOrdered = async <ID>(
  httpClient: DataAPIHttpClient,
  serdes: SerDes,
  documents: readonly SomeDoc[],
  chunkSize: number,
  timeoutManager: TimeoutManager,
  err: new (descs: DataAPIDetailedErrorDescriptor[]) => DataAPIResponseError,
): Promise<ID[]> => {
  const insertedIds: ID[] = [];

  for (let i = 0, n = documents.length; i < n; i += chunkSize) {
    const slice = documents.slice(i, i + chunkSize);

    const [_docResp, inserted, errDesc] = await insertMany<ID>(httpClient, serdes, slice, true, timeoutManager);
    insertedIds.push(...inserted);

    if (errDesc) {
      throw mkRespErrorFromResponse(err, errDesc.command, errDesc.rawResponse, {
        partialResult: {
          insertedIds: insertedIds as SomeId[],
          insertedCount: insertedIds.length,
        },
        // documentResponses: docResp,
        // failedCount: docResp.length - insertedIds.length,
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
  err: new (descs: DataAPIDetailedErrorDescriptor[]) => DataAPIResponseError,
): Promise<ID[]> => {
  const insertedIds: ID[] = [];
  let masterIndex = 0;

  const failCommands = [] as Record<string, unknown>[];
  const failRaw = [] as RawDataAPIResponse[];
  const docResps = [] as GenericInsertManyDocumentResponse<SomeDoc>[];

  const promises = Array.from({ length: concurrency }, async () => {
    while (masterIndex < documents.length) {
      const localI = masterIndex;
      const endIdx = Math.min(localI + chunkSize, documents.length);
      masterIndex += chunkSize;

      if (localI >= endIdx) {
        break;
      }

      const slice = documents.slice(localI, endIdx);

      const [docResp, inserted, errDesc] = await insertMany<ID>(httpClient, serdes, slice, false, timeoutManager);
      insertedIds.push(...inserted);
      docResps.push(...docResp);

      if (errDesc) {
        failCommands.push(errDesc.command);
        failRaw.push(errDesc.rawResponse);
      }
    }
  });
  await Promise.all(promises);

  if (failCommands.length > 0) {
    throw mkRespErrorFromResponses(err, failCommands, failRaw, {
      partialResult: {
        insertedIds: insertedIds as SomeId[],
        insertedCount: insertedIds.length,
      },
      // documentResponses: docResps,
      // failedCount: docResps.length - insertedIds.length,
    });
  }

  return insertedIds;
};

const insertMany = async <ID>(
  httpClient: DataAPIHttpClient,
  serdes: SerDes,
  documents: readonly SomeDoc[],
  ordered: boolean,
  timeoutManager: TimeoutManager,
): Promise<[GenericInsertManyDocumentResponse<ID>[], ID[], DataAPIDetailedErrorDescriptor | undefined]> => {
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
    }, { timeoutManager, bigNumsPresent });
  } catch (e) {
    if (!(e instanceof DataAPIResponseError)) {
      throw e;
    }
    raw = e.detailedErrorDescriptors[0].rawResponse;
    err = e;
  }

  const documentResponses = raw.status?.documentResponses ?? [];
  const errors = raw.errors;

  const insertedIds: ID[] = [];

  for (let i = 0, n = documentResponses.length; i < n; i++) {
    const docResp = documentResponses[i];
    if (docResp.status === "OK") {
      insertedIds.push(serdes.deserialize(docResp._id, raw, SerDesTarget.InsertedId));
    } else if (docResp.errorIdx) {
      docResp.error = errors![docResp.errorIdx];
      delete docResp.errorIdx;
    }
  }

  return [documentResponses, insertedIds, err?.detailedErrorDescriptors[0]];
};
