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
import { HTTPClient } from '@/src/client';
import { executeOperation, setDefaultIdForUpsert, TypeErr, withoutFields } from './utils';
import { InsertOneCommand, InsertOneResult } from '@/src/collections/operations/insert/insert-one';
import {
  InsertManyCommand,
  insertManyOptionKeys,
  InsertManyOptions,
  InsertManyResult
} from '@/src/collections/operations/insert/insert-many';
import {
  UpdateOneCommand,
  updateOneOptionKeys,
  UpdateOneOptions,
  UpdateOneResult,
} from '@/src/collections/operations/update/update-one';
import {
  UpdateManyCommand,
  updateManyOptionKeys,
  UpdateManyOptions,
  UpdateManyResult
} from '@/src/collections/operations/update/update-many';
import { DeleteOneCommand, DeleteOneOptions, DeleteOneResult } from '@/src/collections/operations/delete/delete-one';
import { DeleteManyCommand, DeleteManyResult } from '@/src/collections/operations/delete/delete-many';
import { FindOptions } from '@/src/collections/operations/find/find';
import { FindOneAndResult } from '@/src/collections/operations/find/find-common';
import { FindOneCommand, FindOneOptions, findOneOptionsKeys } from '@/src/collections/operations/find/find-one';
import { FindOneAndDeleteCommand, FindOneAndDeleteOptions } from '@/src/collections/operations/find/find-one-delete';
import {
  FindOneAndUpdateCommand,
  FindOneAndUpdateOptions,
  findOneAndUpdateOptionsKeys
} from '@/src/collections/operations/find/find-one-update';
import {
  FindOneAndReplaceCommand,
  FindOneAndReplaceOptions,
  findOneAndReplaceOptionsKeys
} from '@/src/collections/operations/find/find-one-replace';
import { Filter } from '@/src/collections/operations/filter';
import { UpdateFilter } from '@/src/collections/operations/update-filter';
import { FoundDoc, MaybeId } from '@/src/collections/operations/utils';

export type SomeDoc = Record<any, any>;

export class Collection<Schema extends SomeDoc = SomeDoc> {
  httpClient: HTTPClient;
  name: string;

  constructor(httpClient: HTTPClient, name: string) {
    if (!name) {
      throw new Error('Collection name is required');
    }

    this.httpClient = httpClient.cloneShallow();
    this.httpClient.collectionName = name;
    this.name = name;
  }

  async insertOne(document: Schema): Promise<InsertOneResult> {
    return executeOperation(async () => {
      const command: InsertOneCommand = {
        insertOne: { document },
      }

      const resp = await this.httpClient.executeCommand(command);

      return {
        acknowledged: true,
        insertedId: resp.status?.insertedIds[0],
      };
    });
  }

  async insertMany(documents: Schema[], options?: InsertManyOptions): Promise<InsertManyResult> {
    return executeOperation(async () => {
      const command: InsertManyCommand = {
        insertMany: {
          documents,
          options,
        },
      };

      const resp = await this.httpClient.executeCommand(command, insertManyOptionKeys);

      return {
        acknowledged: true,
        insertedCount: resp.status?.insertedIds?.length || 0,
        insertedIds: resp.status?.insertedIds,
      };
    });
  }

  async updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateOneOptions<Schema>): Promise<UpdateOneResult> {
    return executeOperation(async () => {
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

      const resp = await this.httpClient.executeCommand(command, updateOneOptionKeys);

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
    });
  }

  async updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateManyOptions): Promise<UpdateManyResult> {
    return executeOperation(async () => {
      const command: UpdateManyCommand = {
        updateMany: {
          filter,
          update,
          options,
        },
      };

      setDefaultIdForUpsert(command.updateMany);

      const updateManyResp = await this.httpClient.executeCommand(command, updateManyOptionKeys);

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
    });
  }

  async deleteOne(filter: Filter<Schema>, options?: DeleteOneOptions): Promise<DeleteOneResult> {
    return executeOperation(async () => {
      const command: DeleteOneCommand = {
        deleteOne: { filter },
      };

      if (options?.sort) {
        command.deleteOne.sort = options.sort;
      }

      const deleteOneResp = await this.httpClient.executeCommand(command);

      return {
        acknowledged: true,
        deletedCount: deleteOneResp.status?.deletedCount,
      };
    });
  }

  async deleteMany(filter: Filter<Schema>): Promise<DeleteManyResult> {
    return executeOperation(async () => {
      const command: DeleteManyCommand = {
        deleteMany: { filter },
      };

      const deleteManyResp = await this.httpClient.executeCommand(command);

      if (deleteManyResp.status?.moreData) {
        throw new AstraClientError(`More records found to be deleted even after deleting ${deleteManyResp.status?.deletedCount} records`, command);
      }

      return {
        acknowledged: true,
        deletedCount: deleteManyResp.status?.deletedCount,
      };
    });
  }

  find<GetSim extends boolean>(filter: Filter<Schema>, options?: FindOptions<Schema, GetSim>): FindCursor<FoundDoc<Schema, GetSim>> {
    return new FindCursor(this as any as Collection<FoundDoc<Schema, GetSim>>, filter, options);
  }

  async findOne<GetSim extends boolean>(filter: Filter<Schema>, options?: FindOneOptions<Schema, GetSim>): Promise<FoundDoc<Schema, GetSim> | null> {
    return executeOperation(async () => {
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

      const resp = await this.httpClient.executeCommand(command, findOneOptionsKeys);
      return resp.data?.document;
    });
  }

  async findOneAndReplace(filter: Filter<Schema>, replacement: MaybeId<Schema>, options?: FindOneAndReplaceOptions<Schema>): Promise<FindOneAndResult<Schema>> {
    return executeOperation(async () => {
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

      const resp = await this.httpClient.executeCommand(command, findOneAndReplaceOptionsKeys);

      return {
        value: resp.data?.document,
        ok: 1,
      };
    });
  }

  // noinspection JSUnusedGlobalSymbols
  async distinct(): Promise<TypeErr<'distinct not implemented'>> {
    throw new Error('Not Implemented');
  }

  async countDocuments(filter?: Filter<Schema>): Promise<number> {
    return executeOperation(async (): Promise<number> => {
      const command = {
        countDocuments: { filter },
      };

      const resp = await this.httpClient.executeCommand(command);

      return resp.status?.count;
    });
  }

  async findOneAndDelete(filter: Filter<Schema>, options?: FindOneAndDeleteOptions<Schema>): Promise<FindOneAndResult<Schema>> {
    const command: FindOneAndDeleteCommand = {
      findOneAndDelete: { filter },
    };

    if (options?.sort) {
      command.findOneAndDelete.sort = options.sort;
    }

    const resp = await this.httpClient.executeCommand(command);

    return {
      value: resp.data?.document,
      ok: 1,
    };
  }

  async findOneAndUpdate(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: FindOneAndUpdateOptions<Schema>): Promise<FindOneAndResult<Schema>> {
    return executeOperation(async () => {
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

      const resp = await this.httpClient.executeCommand(command, findOneAndUpdateOptionsKeys);

      return {
        value: resp.data?.document,
        ok: 1,
      };
    });
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
