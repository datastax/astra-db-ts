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
import {
  CollectionInsertManyOptions,
  DataAPIResponseError,
  DeleteManyError,
  FindCursor,
  GenericDeleteManyResult,
  GenericDeleteOneOptions,
  GenericDeleteOneResult,
  GenericFindOneAndDeleteOptions,
  GenericFindOneAndReplaceOptions,
  GenericFindOneAndUpdateOptions,
  GenericFindOneOptions,
  GenericFindOptions,
  GenericInsertManyResult,
  GenericInsertOneResult,
  GenericReplaceOneOptions,
  GenericUpdateManyOptions,
  GenericUpdateOneOptions,
  GenericUpdateResult,
  SomeDoc,
  TooManyDocumentsToCountError,
  UpdateManyError,
} from '@/src/documents';
import { nullish, WithTimeout } from '@/src/lib';
import { insertManyOrdered, insertManyUnordered } from '@/src/documents/commands/helpers/insertion';
import { coalesceUpsertIntoUpdateResult, mkUpdateResult } from '@/src/documents/commands/helpers/updates';
import { mkRespErrorFromResponse } from '@/src/documents/errors';
import { normalizedSort } from '@/src/documents/utils';
import { mkDistinctPathExtractor, pullSafeProjection4Distinct } from '@/src/documents/commands/helpers/distinct';
import stableStringify from 'safe-stable-stringify';

export class CommandImpls<ID> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #serdes: DataAPISerDes;
  readonly #name: string;

  constructor(name: string, httpClient: DataAPIHttpClient, serdes: DataAPISerDes) {
    this.#httpClient = httpClient;
    this.#serdes = serdes;
    this.#name = name;
  }

  public async insertOne(document: SomeDoc, options: WithTimeout | nullish): Promise<GenericInsertOneResult<ID>> {
    const command = mkBasicCmd('insertOne', {
      document: this.#serdes.serializeRecord(document),
    });

    const raw = await this.#httpClient.executeCommand(command, options);

    return {
      insertedId: this.#serdes.deserializeRecord(raw.status!.insertedIds[0], raw.status!) as ID,
    };
  }

  public async insertMany(docs: SomeDoc[], options: CollectionInsertManyOptions | nullish): Promise<GenericInsertManyResult<ID>> {
    const chunkSize = options?.chunkSize ?? 50;
    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);

    const insertedIds = (options?.ordered)
      ? await insertManyOrdered(this.#httpClient, this.#serdes, docs, chunkSize, timeoutManager)
      : await insertManyUnordered(this.#httpClient, this.#serdes, docs, options?.concurrency ?? 8, chunkSize, timeoutManager);

    return {
      insertedCount: insertedIds.length,
      insertedIds: insertedIds as ID[],
    };
  }

  public async updateOne(filter: SomeDoc, update: SomeDoc, options?: GenericUpdateOneOptions): Promise<GenericUpdateResult<ID, 0 | 1>> {
    const command = mkCmdWithSortProj('updateOne', options, {
      filter: this.#serdes.serializeRecord(filter),
      update: this.#serdes.serializeRecord(update),
      options: {
        upsert: options?.upsert,
      },
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return coalesceUpsertIntoUpdateResult(mkUpdateResult(resp), resp);
  }

  public async updateMany(filter: SomeDoc, update: SomeDoc, options?: GenericUpdateManyOptions): Promise<GenericUpdateResult<ID, number>> {
    const command = mkBasicCmd('updateMany', {
      filter: this.#serdes.serializeRecord(filter),
      update: this.#serdes.serializeRecord(update),
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
      filter: this.#serdes.serializeRecord(filter),
      replacement: this.#serdes.serializeRecord(replacement),
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
      filter: this.#serdes.serializeRecord(filter),
    });

    const deleteOneResp = await this.#httpClient.executeCommand(command, options);

    return {
      deletedCount: deleteOneResp.status?.deletedCount,
    };
  }

  public async deleteMany(filter: SomeDoc, options?: WithTimeout): Promise<GenericDeleteManyResult> {
    const command = mkBasicCmd('deleteMany', {
      filter: this.#serdes.serializeRecord(filter),
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
    if (options?.sort) {
      options.sort = normalizedSort(options.sort);
    }
    return new FindCursor(keyspace, this.#name, this.#httpClient, this.#serdes, this.#serdes.serializeRecord(structuredClone(filter)), structuredClone(options));
  }

  public async findOne<Schema>(filter: SomeDoc, options?: GenericFindOneOptions): Promise<Schema | null> {
    const command = mkCmdWithSortProj('findOne', options, {
      filter: this.#serdes.serializeRecord(filter),
      options: {
        includeSimilarity: options?.includeSimilarity,
      },
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return this.#serdes.deserializeRecord(resp.data?.document, resp) as any;
  }

  public async findOneAndReplace<Schema extends SomeDoc>(filter: SomeDoc, replacement: SomeDoc, options?: GenericFindOneAndReplaceOptions): Promise<Schema | null> {
    const command = mkCmdWithSortProj('findOneAndReplace', options, {
      filter: this.#serdes.serializeRecord(filter),
      replacement: this.#serdes.serializeRecord(replacement),
      options: {
        returnDocument: options?.returnDocument,
        upsert: options?.upsert,
      },
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.data?.document || null;
  }

  public async findOneAndDelete<Schema extends SomeDoc>(filter: SomeDoc, options?: GenericFindOneAndDeleteOptions): Promise<Schema | null> {
    const command = mkCmdWithSortProj('findOneAndDelete', options, {
      filter: this.#serdes.serializeRecord(filter),
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.data?.document || null;
  }

  public async findOneAndUpdate<Schema extends SomeDoc>(filter: SomeDoc, update: SomeDoc, options?: GenericFindOneAndUpdateOptions): Promise<Schema | null> {
    const command = mkCmdWithSortProj('findOneAndUpdate', options, {
      filter: this.#serdes.serializeRecord(filter),
      update: this.#serdes.serializeRecord(update),
      options: {
        returnDocument: options?.returnDocument,
        upsert: options?.upsert,
      },
    });

    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.data?.document || null;
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
