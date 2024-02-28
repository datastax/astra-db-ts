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

import { FindCursor } from './cursor';
import { HTTPClient } from '@/src/api';
import { setDefaultIdForInsert, setDefaultIdForUpsert, TypeErr, withoutFields } from './utils';
import { InsertOneCommand, InsertOneResult } from '@/src/client/operations/insert/insert-one';
import {
  InsertManyCommand,
  insertManyOptionKeys,
  InsertManyOptions,
  InsertManyResult
} from '@/src/client/operations/insert/insert-many';
import {
  UpdateOneCommand,
  updateOneOptionKeys,
  UpdateOneOptions,
  UpdateOneResult,
} from '@/src/client/operations/update/update-one';
import {
  UpdateManyCommand,
  updateManyOptionKeys,
  UpdateManyOptions,
  UpdateManyResult
} from '@/src/client/operations/update/update-many';
import { DeleteOneCommand, DeleteOneOptions, DeleteOneResult } from '@/src/client/operations/delete/delete-one';
import { DeleteManyCommand, DeleteManyResult } from '@/src/client/operations/delete/delete-many';
import { FindOptions } from '@/src/client/operations/find/find';
import { FindOneAndModifyResult } from '@/src/client/operations/find/find-common';
import { FindOneCommand, FindOneOptions, findOneOptionsKeys } from '@/src/client/operations/find/find-one';
import { FindOneAndDeleteCommand, FindOneAndDeleteOptions } from '@/src/client/operations/find/find-one-delete';
import {
  FindOneAndUpdateCommand,
  FindOneAndUpdateOptions,
  findOneAndUpdateOptionsKeys
} from '@/src/client/operations/find/find-one-update';
import {
  FindOneAndReplaceCommand,
  FindOneAndReplaceOptions,
  findOneAndReplaceOptionsKeys
} from '@/src/client/operations/find/find-one-replace';
import { Filter } from '@/src/client/operations/filter';
import { UpdateFilter } from '@/src/client/operations/update-filter';
import { FoundDoc, MaybeId } from '@/src/client/operations/utils';
import { SomeDoc } from '@/src/client/document';
import {
  FailedInsert,
  InsertManyBulkOptions,
  InsertManyBulkResult
} from '@/src/client/operations/insert/insert-many-bulk';
import { CollectionOptions } from '@/src/client/operations/collections/create-collection';
import { Db } from '@/src/client/db';

export class Collection<Schema extends SomeDoc = SomeDoc> {
  collectionName: string;
  _httpClient: HTTPClient;
  _db: Db

  constructor(db: Db, name: string) {
    if (!name) {
      throw new Error("collection name is required");
    }

    this._httpClient = db.httpClient.cloneShallow();
    this._httpClient.collection = name;

    this.collectionName = name;
    this._db = db;
  }

  get namespace(): string {
    return this._db.namespace;
  }

  get readConcern (): { level: 'majority' } {
    return { level: 'majority' };
  }

  get writeConcern (): { level: 'majority' } {
    return { level: 'majority' };
  }

  async insertOne(document: Schema): Promise<InsertOneResult> {
    setDefaultIdForInsert(document);

    const command: InsertOneCommand = {
      insertOne: { document },
    }

    const resp = await this._httpClient.executeCommand(command);

    return {
      acknowledged: true,
      insertedId: resp.status?.insertedIds[0],
    };
  }

  async insertMany(documents: Schema[], options?: InsertManyOptions): Promise<InsertManyResult> {
    documents.forEach(setDefaultIdForInsert);

    const command: InsertManyCommand = {
      insertMany: {
        documents,
        options,
      },
    };

    const resp = await this._httpClient.executeCommand(command, insertManyOptionKeys);

    return {
      acknowledged: true,
      insertedCount: resp.status?.insertedIds?.length || 0,
      insertedIds: resp.status?.insertedIds,
    };
  }

  async insertManyBulk(documents: Schema[], options?: InsertManyBulkOptions): Promise<InsertManyBulkResult<Schema>> {
    const chunkSize = (options?.chunkSize ?? 20);
    const parallel = (options?.ordered) ? 1 : (options?.parallel ?? 4);

    // @ts-expect-error - Sanity check for JS users or bad people who disobey the TS transpiler
    if (options?.ordered && options?.parallel && options?.parallel !== 1) {
      throw new Error('Parallel insert with ordered option is not supported');
    }

    if (chunkSize < 1 || chunkSize > 20) {
      throw new Error('Chunk size must be between 1 and 20, inclusive');
    }

    if (parallel < 1) {
      throw new Error('Parallel must be greater than 0');
    }

    const results: InsertManyResult[] = [];
    const failedInserts: FailedInsert<Schema>[] = [];

    const workerChunkSize = Math.ceil(documents.length / parallel);

    const processQueue = async (i: number) => {
      const startIdx = i * workerChunkSize;
      const endIdx = (i + 1) * workerChunkSize;

      for (let i = startIdx; i < endIdx; i += chunkSize) {
        const slice = documents.slice(i, Math.min(i + chunkSize, endIdx));

        if (slice.length === 0) {
          break;
        }

        try {
          const result = await this.insertMany(slice);
          results.push(result);
        } catch (e: any) {
          const insertedIDs = e.status?.insertedIds ?? [];
          const insertedIDSet = new Set(insertedIDs);

          results.push({
            acknowledged: true,
            insertedCount: insertedIDs.length,
            insertedIds: insertedIDs,
          });

          const upperBound = (options?.ordered)
            ? documents.length
            : Math.min(i + chunkSize, endIdx);

          for (let j = i; j < upperBound; j += 1) {
            const doc = documents[j];

            if (insertedIDSet.has(doc._id)) {
              insertedIDSet.delete(doc._id);
            } else {
              failedInserts.push({ document: doc, error: e });
            }
          }

          if (options?.ordered) {
            break;
          }
        }
      }
    };

    const workers = Array.from({ length: parallel }, (_, i) => {
      return processQueue(i);
    });

    await Promise.all(workers);

    return {
      acknowledged: true,
      insertedCount: results.reduce((acc, r) => acc + r.insertedCount, 0),
      insertedIds: results.reduce((acc, r) => acc.concat(r.insertedIds), [] as string[]),
      failedCount: failedInserts.length,
      failedInserts,
    };
  }

  async updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateOneOptions<Schema>): Promise<UpdateOneResult> {
    const command: UpdateOneCommand = {
      updateOne: {
        filter,
        update,
        options: withoutFields(options, 'sort'),
      },
    };

    if (options?.sort) {
      command.updateOne.sort = options.sort;
    }

    setDefaultIdForUpsert(command.updateOne);

    const resp = await this._httpClient.executeCommand(command, updateOneOptionKeys);

    const commonResult = {
      modifiedCount: resp.status?.modifiedCount,
      matchedCount: resp.status?.matchedCount,
      acknowledged: true,
    } as const;

    return (resp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: resp.status?.upsertedId,
        upsertedCount: 1,
      }
      : commonResult;
  }

  async updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateManyOptions): Promise<UpdateManyResult> {
    const command: UpdateManyCommand = {
      updateMany: {
        filter,
        update,
        options,
      },
    };

    setDefaultIdForUpsert(command.updateMany);

    const updateManyResp = await this._httpClient.executeCommand(command, updateManyOptionKeys);

    if (updateManyResp.status?.moreData) {
      throw new AstraClientError(
        `More than ${updateManyResp.status?.modifiedCount} records found for update by the server`,
        command,
      );
    }

    const commonResult = {
      modifiedCount: updateManyResp.status?.modifiedCount,
      matchedCount: updateManyResp.status?.matchedCount,
      acknowledged: true,
    } as const;

    return (updateManyResp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: updateManyResp.status?.upsertedId,
        upsertedCount: 1,
      }
      : commonResult;
  }

  async deleteOne(filter: Filter<Schema>, options?: DeleteOneOptions): Promise<DeleteOneResult> {
    const command: DeleteOneCommand = {
      deleteOne: { filter },
    };

    if (options?.sort) {
      command.deleteOne.sort = options.sort;
    }

    const deleteOneResp = await this._httpClient.executeCommand(command);

    return {
      acknowledged: true,
      deletedCount: deleteOneResp.status?.deletedCount,
    };
  }

  async deleteMany(filter: Filter<Schema>): Promise<DeleteManyResult> {
    const command: DeleteManyCommand = {
      deleteMany: { filter },
    };

    const deleteManyResp = await this._httpClient.executeCommand(command);

    if (deleteManyResp.status?.moreData) {
      throw new AstraClientError(`More records found to be deleted even after deleting ${deleteManyResp.status?.deletedCount} records`, command);
    }

    return {
      acknowledged: true,
      deletedCount: deleteManyResp.status?.deletedCount,
    };
  }

  find<GetSim extends boolean = false>(filter: Filter<Schema>, options?: FindOptions<Schema, GetSim>): FindCursor<FoundDoc<Schema, GetSim>> {
    return new FindCursor(this._httpClient, filter, options) as any;
  }

  async findOne<GetSim extends boolean = false>(filter: Filter<Schema>, options?: FindOneOptions<Schema, GetSim>): Promise<FoundDoc<Schema, GetSim> | null> {
    const command: FindOneCommand = {
      findOne: {
        filter,
        options: withoutFields(options, 'sort', 'projection'),
      },
    };

    if (options?.sort) {
      command.findOne.sort = options.sort;
      delete options.sort;
    }

    if (options?.projection && Object.keys(options.projection).length > 0) {
      command.findOne.projection = options.projection;
      delete options.projection;
    }

    const resp = await this._httpClient.executeCommand(command, findOneOptionsKeys);
    return resp.data?.document;
  }

  async findOneAndReplace(filter: Filter<Schema>, replacement: MaybeId<Schema>, options?: FindOneAndReplaceOptions<Schema>): Promise<FindOneAndModifyResult<Schema>> {
    const command: FindOneAndReplaceCommand = {
      findOneAndReplace: {
        filter,
        replacement,
        options,
      },
    };

    setDefaultIdForUpsert(command.findOneAndReplace, true);

    if (options?.sort) {
      command.findOneAndReplace.sort = options.sort;
      delete options.sort;
    }

    const resp = await this._httpClient.executeCommand(command, findOneAndReplaceOptionsKeys);

    return {
      value: resp.data?.document,
      ok: 1,
    };
  }

  // noinspection JSUnusedGlobalSymbols
  async distinct(): Promise<TypeErr<'distinct not implemented'>> {
    throw new Error('Not Implemented');
  }

  /**
   * @deprecated Use {@link countDocuments} instead
   */
  async count(filter?: Filter<Schema>): Promise<number> {
    return this.countDocuments(filter);
  }

  async countDocuments(filter?: Filter<Schema>): Promise<number> {
    const command = {
      countDocuments: { filter },
    };

    const resp = await this._httpClient.executeCommand(command);

    return resp.status?.count;
  }

  async findOneAndDelete(filter: Filter<Schema>, options?: FindOneAndDeleteOptions<Schema>): Promise<FindOneAndModifyResult<Schema>> {
    const command: FindOneAndDeleteCommand = {
      findOneAndDelete: { filter },
    };

    if (options?.sort) {
      command.findOneAndDelete.sort = options.sort;
    }

    const resp = await this._httpClient.executeCommand(command);

    return {
      value: resp.data?.document,
      ok: 1,
    };
  }

  async findOneAndUpdate(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: FindOneAndUpdateOptions<Schema>): Promise<FindOneAndModifyResult<Schema>> {
    const command: FindOneAndUpdateCommand = {
      findOneAndUpdate: {
        filter,
        update,
        options,
      },
    };

    setDefaultIdForUpsert(command.findOneAndUpdate);

    if (options?.sort) {
      command.findOneAndUpdate.sort = options.sort;
      delete options.sort;
    }

    const resp = await this._httpClient.executeCommand(command, findOneAndUpdateOptionsKeys);

    return {
      value: resp.data?.document,
      ok: 1,
    };
  }

  async options(): Promise<CollectionOptions<SomeDoc>> {
    const results = await this._db.listCollections({ nameOnly: false });

    const collection = results.find((c) => c.name === this.collectionName);

    if (!collection) {
      throw new Error(`Collection ${this.collectionName} not found`);
    }

    return collection.options ?? {};
  }

  async drop(): Promise<boolean> {
    return await this._db.dropCollection(this.collectionName);
  }

  /**
   * @deprecated Use {@link collectionName} instead
   */
  get name(): string {
    return this.collectionName;
  }
}

export class AstraClientError extends Error {
  command: Record<string, any>;

  constructor(message: any, command: Record<string, any>) {
    const commandName = Object.keys(command)[0] || 'unknown';
    super(`Command "${commandName}" failed with the following error: ${message}`);
    this.command = command;
  }
}
