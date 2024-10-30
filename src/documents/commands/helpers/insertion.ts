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
import { DataAPISerDes } from '@/src/lib/api/ser-des';
import { TimeoutManager } from '@/src/lib/api/timeout-managers';
import {
  DataAPIDetailedErrorDescriptor, DataAPIResponseError,
  InsertManyError,
  mkRespErrorFromResponse,
  mkRespErrorFromResponses,
} from '@/src/documents/errors';
import { GenericInsertManyDocumentResponse, SomeDoc, SomeId } from '@/src/documents';

export type MkID<ID> = (id: any, resp: Record<string, string>) => ID;

export const insertManyOrdered = async <ID>(httpClient: DataAPIHttpClient, serdes: DataAPISerDes, documents: unknown[], chunkSize: number, timeoutManager: TimeoutManager, mkID: MkID<ID>): Promise<ID[]> => {
  const insertedIds: any = [];

  for (let i = 0, n = documents.length; i < n; i += chunkSize) {
    const slice = documents.slice(i, i + chunkSize);

    const [_docResp, inserted, errDesc] = await insertMany<ID>(httpClient, serdes, slice, true, timeoutManager, mkID);
    insertedIds.push(...inserted);

    if (errDesc) {
      throw mkRespErrorFromResponse(InsertManyError, errDesc.command, errDesc.rawResponse, {
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

export const insertManyUnordered = async <ID>(httpClient: DataAPIHttpClient, serdes: DataAPISerDes, documents: unknown[], concurrency: number, chunkSize: number, timeoutManager: TimeoutManager, mkID: MkID<ID>): Promise<ID[]> => {
  const insertedIds: any = [];
  let masterIndex = 0;

  const failCommands = [] as Record<string, any>[];
  const failRaw = [] as Record<string, any>[];
  const docResps = [] as GenericInsertManyDocumentResponse<SomeDoc>[];

  const workers = Array.from({ length: concurrency }, async () => {
    while (masterIndex < documents.length) {
      const localI = masterIndex;
      const endIdx = Math.min(localI + chunkSize, documents.length);
      masterIndex += chunkSize;

      if (localI >= endIdx) {
        break;
      }

      const slice = documents.slice(localI, endIdx);

      const [docResp, inserted, errDesc] = await insertMany<ID>(httpClient, serdes, slice, false, timeoutManager, mkID);
      insertedIds.push(...inserted);
      docResps.push(...docResp);

      if (errDesc) {
        failCommands.push(errDesc.command);
        failRaw.push(errDesc.rawResponse);
      }
    }
  });
  await Promise.all(workers);

  if (failCommands.length > 0) {
    throw mkRespErrorFromResponses(InsertManyError, failCommands, failRaw, {
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

const insertMany = async <ID>(httpClient: DataAPIHttpClient, serdes: DataAPISerDes, documents: unknown[], ordered: boolean, timeoutManager: TimeoutManager, mkID: MkID<ID>): Promise<[GenericInsertManyDocumentResponse<ID>[], ID[], DataAPIDetailedErrorDescriptor | undefined]> => {
  let raw, err: DataAPIResponseError | undefined;

  try {
    raw = await httpClient.executeCommand({
      insertMany: {
        documents: serdes.serializeRecord(documents),
        options: {
          returnDocumentResponses: true,
          ordered,
        },
      },
    }, { timeoutManager });
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
    docResp.document = serdes.deserializeRecord(docResp.document, raw);

    if (docResp.status === "OK") {
      insertedIds.push(mkID(docResp._id, raw.status!));
    } else if (docResp.errorIdx) {
      docResp.error = errors![docResp.errorIdx];
      delete docResp.errorIdx;
    }
  }

  return [documentResponses, insertedIds, err?.detailedErrorDescriptors[0]];
};
