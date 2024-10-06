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

import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import {
  DataAPIResponseError,
  DeleteManyError,
  FindCursor,
  CollectionInsertManyOptions,
  CollectionModifyResult,
  SomeDoc,
  TooManyDocumentsToCountError,
  UpdateManyError,
  WithId,
} from '@/src/documents';
import { nullish, WithTimeout } from '@/src/lib';
import { insertManyOrdered, insertManyUnordered, MkID } from '@/src/documents/commands/helpers/insertion';
import { normalizedSort } from '@/src/documents/utils';
import { mkRespErrorFromResponse } from '@/src/documents/errors';
import { coalesceUpsertIntoUpdateResult, mkUpdateResult } from '@/src/documents/commands/helpers/updates';
import { GenericInsertOneResult } from '@/src/documents/commands/types/insert/insert-one';
import { GenericInsertManyResult } from '@/src/documents/commands/types/insert/insert-many';
import { GenericUpdateOneOptions } from '@/src/documents/commands/types/update/update-one';
import { GenericUpdateResult } from '@/src/documents/commands/types/update/update-common';
import { GenericUpdateManyOptions } from '@/src/documents/commands/types/update/update-many';
import { GenericReplaceOneOptions } from '@/src/documents/commands/types/update/replace-one';
import { GenericDeleteOneOptions, GenericDeleteOneResult } from '@/src/documents/commands/types/delete/delete-one';
import { GenericDeleteManyResult } from '@/src/documents/commands/types/delete/delete-many';
import { GenericFindOneOptions } from '@/src/documents/commands/types/find/find-one';
import { GenericFindOneAndReplaceOptions } from '@/src/documents/commands/types/find/find-one-replace';
import { GenericFindOneAndDeleteOptions } from '@/src/documents/commands/types/find/find-one-delete';
import { GenericFindOneAndUpdateOptions } from '@/src/documents/commands/types/find/find-one-update';
import { runFindOneAnd } from '@/src/documents/commands/helpers/modify';
import stableStringify from 'safe-stable-stringify';
import { mkDistinctPathExtractor, pullSafeProjection4Distinct } from '@/src/documents/commands/helpers/distinct';
import { GenericFindOptions } from '@/src/documents/commands/types/find/find';

export class CommandImpls<ID> {
  readonly #httpClient: DataAPIHttpClient;

  constructor(httpClient: DataAPIHttpClient) {
    this.#httpClient = httpClient;
  }

  public async insertOne(document: SomeDoc, options: WithTimeout | nullish, mkID: MkID<ID>): Promise<GenericInsertOneResult<ID>> {
    const command = mkBasicCmd('insertOne', {
      document,
    });

    const { status } = await this.#httpClient.executeCommand(command, options);

    return {
      insertedId: mkID(status!.insertedIds[0], status!),
    };
  }

  public async insertMany(docs: SomeDoc[], options: CollectionInsertManyOptions | nullish, mkID: MkID<ID>): Promise<GenericInsertManyResult<ID>> {
    const chunkSize = options?.chunkSize ?? 50;
    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);

    const insertedIds = (options?.ordered)
      ? await insertManyOrdered(this.#httpClient, docs, chunkSize, timeoutManager, mkID)
      : await insertManyUnordered(this.#httpClient, docs, options?.concurrency ?? 8, chunkSize, timeoutManager, mkID);

    return {
      insertedCount: insertedIds.length,
      insertedIds: insertedIds,
    };
  }

  public async updateOne(filter: SomeDoc, update: SomeDoc, options?: GenericUpdateOneOptions): Promise<GenericUpdateResult<ID, 0 | 1>> {
    const command = mkCmdWithSortProj('updateOne', options, {
      filter,
      update,
      options: {
        upsert: options?.upsert,
      },
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return coalesceUpsertIntoUpdateResult(mkUpdateResult(resp), resp);
  }

  public async updateMany(filter: SomeDoc, update: SomeDoc, options?: GenericUpdateManyOptions): Promise<GenericUpdateResult<ID, number>> {
    const command = mkBasicCmd('updateMany', {
      filter,
      update,
      options: {
        pageState: undefined as string | undefined,
        upsert: options?.upsert,
      },
    });

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);
    const commonResult = mkUpdateResult<number>();
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

  public async replaceOne(filter: SomeDoc, replacement: SomeDoc, options?: GenericReplaceOneOptions): Promise<GenericUpdateResult<ID, 0 | 1>> {
    const command = mkCmdWithSortProj('findOneAndReplace', options, {
      filter,
      replacement,
      options: {
        returnDocument: 'before',
        upsert: options?.upsert,
      },
      projection: { '*': 0 },
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return coalesceUpsertIntoUpdateResult(mkUpdateResult(resp), resp);
  }

  public async deleteOne(filter: SomeDoc, options?: GenericDeleteOneOptions): Promise<GenericDeleteOneResult> {
    const command = mkCmdWithSortProj('deleteOne', options, {
      filter,
    });

    const deleteOneResp = await this.#httpClient.executeCommand(command, options);

    return {
      deletedCount: deleteOneResp.status?.deletedCount,
    };
  }

  public async deleteMany(filter: SomeDoc, options?: WithTimeout): Promise<GenericDeleteManyResult> {
    const command = mkBasicCmd('deleteMany', {
      filter,
    });

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);
    let resp, numDeleted = 0;

    try {
      while (!resp || resp.status?.moreData) {
        resp = await this.#httpClient.executeCommand(command, { timeoutManager });
        numDeleted += resp.status?.deletedCount ?? 0;
      }
    } catch (e) {
      if (!(e instanceof DataAPIResponseError)) {
        throw e;
      }

      const desc = e.detailedErrorDescriptors[0];

      throw mkRespErrorFromResponse(DeleteManyError, command, desc.rawResponse, {
        partialResult: {
          deletedCount: numDeleted + (desc.rawResponse.status?.deletedCount ?? 0),
        },
      });
    }

    return {
      deletedCount: numDeleted,
    };
  }

  public find<Schema extends SomeDoc>(keyspace: string, filter: SomeDoc, options?: GenericFindOptions): FindCursor<Schema, Schema> {
    return new FindCursor(keyspace, this.#httpClient, filter, options);
  }

  public async findOne<Schema>(filter: SomeDoc, options?: GenericFindOneOptions): Promise<Schema | null> {
    const command = mkCmdWithSortProj('findOne', options, {
      filter,
      options: {
        includeSimilarity: options?.includeSimilarity,
      },
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.data?.document;
  }

  public async findOneAndReplace<Schema extends SomeDoc>(filter: SomeDoc, replacement: SomeDoc, options?: GenericFindOneAndReplaceOptions): Promise<CollectionModifyResult<Schema> | WithId<Schema> | null> {
    const command = mkCmdWithSortProj('findOneAndReplace', options, {
      filter,
      replacement,
      options: {
        returnDocument: options?.returnDocument,
        upsert: options?.upsert,
      },
    });
    return runFindOneAnd(this.#httpClient, command, options);
  }

  public async findOneAndDelete<Schema extends SomeDoc>(filter: SomeDoc, options?: GenericFindOneAndDeleteOptions): Promise<CollectionModifyResult<Schema> | WithId<Schema> | null> {
    const command = mkCmdWithSortProj('findOneAndDelete', options, {
      filter,
    });
    return runFindOneAnd(this.#httpClient, command, options);
  }

  public async findOneAndUpdate<Schema extends SomeDoc>(filter: SomeDoc, update: SomeDoc, options?: GenericFindOneAndUpdateOptions): Promise<CollectionModifyResult<Schema> | WithId<Schema> | null> {
    const command = mkCmdWithSortProj('findOneAndUpdate', options, {
      filter,
      update,
      options: {
        returnDocument: options?.returnDocument,
        upsert: options?.upsert,
      },
    });
    return runFindOneAnd(this.#httpClient, command, options);
  }

  public async distinct(keyspace: string, key: string, filter: SomeDoc): Promise<any[]> {
    const projection = pullSafeProjection4Distinct(key);
    const cursor = this.find(keyspace, filter, { projection: { _id: 0, [projection]: 1 } });

    const seen = new Set<unknown>();
    const ret = [];

    const extract = mkDistinctPathExtractor(key);

    for await (const doc of cursor) {
      const values = extract(doc);

      for (let i = 0, n = values.length; i < n; i++) {
        const value = values[i];

        const key = (typeof value === 'object')
          ? stableStringify(value)
          : value;

        if (!seen.has(key)) {
          ret.push(value);
          seen.add(key);
        }
      }
    }

    return ret;
  }

  public async countDocuments(filter: SomeDoc, upperBound: number, options?: WithTimeout): Promise<number> {
    if (!upperBound) {
      throw new Error('upperBound is required');
    }

    if (upperBound < 0) {
      throw new Error('upperBound must be >= 0');
    }

    const command = mkBasicCmd('countDocuments', {
      filter,
    });

    const resp = await this.#httpClient.executeCommand(command, options);

    if (resp.status?.moreData) {
      throw new TooManyDocumentsToCountError(resp.status.count, true);
    }

    if (resp.status?.count > upperBound) {
      throw new TooManyDocumentsToCountError(upperBound, false);
    }

    return resp.status?.count;
  }

  public async estimatedDocumentCount(options?: WithTimeout): Promise<number> {
    const command = mkBasicCmd('estimatedDocumentCount', {});
    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.status?.count;
  }
}

const mkBasicCmd = (name: string, body: SomeDoc) => ({ [name]: body });

const mkCmdWithSortProj = (name: string, options: { sort?: SomeDoc, projection?: SomeDoc } | nullish, body: SomeDoc) => {
  const command = mkBasicCmd(name, body);

  if (options) {
    if (options.sort) {
      body.sort = normalizedSort(options.sort);
    }

    if (options.projection && Object.keys(options.projection).length > 0) {
      body.projection = options.projection;
    }
  }

  return command;
};
