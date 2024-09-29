import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import {
  DataAPIResponseError,
  Filter,
  InsertManyOptions,
  SomeDoc,
  UpdateFilter,
  UpdateManyError,
} from '@/src/documents';
import { nullish, WithTimeout } from '@/src/lib';
import { GenericInsertOneResult } from '@/src/documents/commands/types/insert/insert-one';
import { MkID } from '@/src/documents/commands/types/insert/mk-id';
import { insertManyOrdered, insertManyUnordered } from '@/src/documents/commands/helpers/insert-many';
import { GenericInsertManyResult } from '@/src/documents/commands/types/insert/insert-many';
import { normalizeSort } from '@/src/documents/utils';
import { InternalUpdateResult } from '@/src/documents/commands/types/update/update-common';
import { mkRespErrorFromResponse } from '@/src/documents/errors';
import { GenericUpdateOneOptions } from '@/src/documents/commands/types/update/update-one';
import { GenericUpdateManyOptions } from '@/src/documents/commands/types/update/update-many';
import { coalesceUpsertIntoUpdateResult, mkCommonUpdateResult } from '@/src/documents/commands/helpers/updates';

export class CommandImpls<ID> {
  readonly #httpClient: DataAPIHttpClient;

  constructor(httpClient: DataAPIHttpClient) {
    this.#httpClient = httpClient;
  }

  public async insertOne(doc: SomeDoc, options: WithTimeout | nullish, mkID: MkID<ID>): Promise<GenericInsertOneResult<ID>> {
    const { status } = await this.#httpClient.executeCommand({ insertOne: { document: doc } }, options);
    return { insertedId: mkID(status!, status!.insertedIds[0]) };
  }

  public async insertMany(docs: SomeDoc[], options: InsertManyOptions | nullish, mkID: MkID<ID>): Promise<GenericInsertManyResult<ID>> {
    const chunkSize = options?.chunkSize ?? 50;
    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);

    const insertedIds = (options?.ordered)
      ? await insertManyOrdered<ID>(this.#httpClient, docs, chunkSize, timeoutManager, mkID)
      : await insertManyUnordered<ID>(this.#httpClient, docs, options?.concurrency ?? 8, chunkSize, timeoutManager, mkID);

    return {
      insertedCount: insertedIds.length,
      insertedIds: insertedIds,
    };
  }

  public async updateOne(filter: Filter<SomeDoc>, update: UpdateFilter<SomeDoc>, options?: GenericUpdateOneOptions): Promise<InternalUpdateResult<ID, 0 | 1>> {
    const command = {
      updateOne: {
        filter,
        update,
        sort: normalizeSort(options?.sort),
        options: {
          upsert: options?.upsert,
        },
      },
    };

    const resp = await this.#httpClient.executeCommand(command, options);
    return coalesceUpsertIntoUpdateResult(mkCommonUpdateResult(), resp);
  }

  public async updateMany(filter: Filter<SomeDoc>, update: UpdateFilter<SomeDoc>, options?: GenericUpdateManyOptions): Promise<InternalUpdateResult<ID, number>> {
    const command = {
      updateMany: {
        filter,
        update,
        options: {
          upsert: options?.upsert,
          pageState: undefined as string | undefined,
        },
      },
    };

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);
    const commonResult = mkCommonUpdateResult<number>();

    let resp;

    try {
      while (!resp || resp.status?.nextPageState) {
        resp = await this.#httpClient.executeCommand(command, { timeoutManager });
        command.updateMany.options.pageState = resp.status?.nextPageState ;
        commonResult.modifiedCount += resp.status?.modifiedCount ?? 0;
        commonResult.matchedCount += resp.status?.matchedCount ?? 0;
      }
    } catch (e) {
      if (!(e instanceof DataAPIResponseError)) {
        throw e;
      }
      const { rawResponse: raw } = e.detailedErrorDescriptors[0];

      commonResult.modifiedCount += raw.status?.modifiedCount ?? 0;
      commonResult.matchedCount += raw.status?.matchedCount ?? 0;

      throw mkRespErrorFromResponse(UpdateManyError, command, raw, {
        partialResult: { ...commonResult, upsertedCount: raw.status?.upsertedCount ?? 0 },
      });
    }

    return coalesceUpsertIntoUpdateResult(commonResult, resp);
  }
}
