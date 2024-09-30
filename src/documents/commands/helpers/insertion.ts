import {
  DataAPIDetailedErrorDescriptor,
  DataAPIResponseError,
  InsertManyError,
  SomeDoc,
  SomeId,
} from '@/src/documents';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { TimeoutManager } from '@/src/lib/api/timeout-managers';
import { mkRespErrorFromResponse, mkRespErrorFromResponses } from '@/src/documents/errors';
import { GenericInsertManyDocumentResponse } from '@/src/documents/commands/types/insert/insert-many';

export type MkID<ID> = (id: any, resp: Record<string, string>) => ID;

export const insertManyOrdered = async <ID>(httpClient: DataAPIHttpClient, documents: unknown[], chunkSize: number, timeoutManager: TimeoutManager, mkID: MkID<ID>): Promise<ID[]> => {
  const insertedIds: any = [];

  for (let i = 0, n = documents.length; i < n; i += chunkSize) {
    const slice = documents.slice(i, i + chunkSize);

    const [_docResp, inserted, errDesc] = await insertMany<ID>(httpClient, slice, true, timeoutManager, mkID);
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

export const insertManyUnordered = async <ID>(httpClient: DataAPIHttpClient, documents: unknown[], concurrency: number, chunkSize: number, timeoutManager: TimeoutManager, mkID: MkID<ID>): Promise<ID[]> => {
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

      const [docResp, inserted, errDesc] = await insertMany<ID>(httpClient, slice, false, timeoutManager, mkID);
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

const insertMany = async <ID>(httpClient: DataAPIHttpClient, documents: unknown[], ordered: boolean, timeoutManager: TimeoutManager, mkID: MkID<ID>): Promise<[GenericInsertManyDocumentResponse<ID>[], ID[], DataAPIDetailedErrorDescriptor | undefined]> => {
  let resp, err: DataAPIResponseError | undefined;

  try {
    resp = await httpClient.executeCommand({
      insertMany: {
        documents,
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
    resp = e.detailedErrorDescriptors[0].rawResponse;
    err = e;
  }

  const documentResponses = resp.status?.documentResponses ?? [];
  const errors = resp.errors;

  const insertedIds: ID[] = [];

  for (let i = 0, n = documentResponses.length; i < n; i++) {
    const docResp = documentResponses[i];

    if (docResp.status === "OK") {
      insertedIds.push(mkID(docResp._id, resp.status!));
    } else if (docResp.errorIdx) {
      docResp.error = errors![docResp.errorIdx];
      delete docResp.errorIdx;
    }
  }

  return [documentResponses, insertedIds, err?.detailedErrorDescriptors[0]];
};
