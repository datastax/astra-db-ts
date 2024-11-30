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

import { DataAPIHttpClient } from '@/src/lib/api/clients';
import { SomeSerDes } from '@/src/lib/api/ser-des';
import {
  DataAPIDetailedErrorDescriptor,
  DataAPIResponseError,
  mkRespErrorFromResponse,
  mkRespErrorFromResponses,
} from '@/src/documents/errors';
import { GenericInsertManyDocumentResponse, SomeDoc, SomeId } from '@/src/documents';
import { TimeoutManager } from '@/src/lib/api/timeouts';

/**
 * @internal
 */
export const insertManyOrdered = async <ID>(
  httpClient: DataAPIHttpClient,
  serdes: SomeSerDes,
  documents: readonly unknown[],
  chunkSize: number,
  timeoutManager: TimeoutManager,
  err: new (descs: DataAPIDetailedErrorDescriptor[]) => DataAPIResponseError,
): Promise<ID[]> => {
  const insertedIds: any = [];

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
  serdes: SomeSerDes,
  documents: readonly unknown[],
  concurrency: number,
  chunkSize: number,
  timeoutManager: TimeoutManager,
  err: new (descs: DataAPIDetailedErrorDescriptor[]) => DataAPIResponseError,
): Promise<ID[]> => {
  const insertedIds: any = [];
  let masterIndex = 0;

  const failCommands = [] as Record<string, any>[];
  const failRaw = [] as Record<string, any>[];
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
  serdes: SomeSerDes,
  documents: readonly unknown[],
  ordered: boolean,
  timeoutManager: TimeoutManager,
): Promise<[GenericInsertManyDocumentResponse<ID>[], ID[], DataAPIDetailedErrorDescriptor | undefined]> => {
  let raw, err: DataAPIResponseError | undefined;

  try {
    const [docs, bigNumsPresent] = serdes.serializeRecord(documents);

    raw = await httpClient.executeCommand({
      insertMany: {
        documents: docs,
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
    const docResp = serdes.deserializeRecord(documentResponses[i], raw)!;

    if (docResp.status === "OK") {
      insertedIds.push(docResp._id);
    } else if (docResp.errorIdx) {
      docResp.error = errors![docResp.errorIdx];
      delete docResp.errorIdx;
    }
  }

  return [documentResponses, insertedIds, err?.detailedErrorDescriptors[0]];
};
