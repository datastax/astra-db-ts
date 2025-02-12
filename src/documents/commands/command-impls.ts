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
import type {
  Collection,
  CollectionInsertManyOptions,
  DataAPIDetailedErrorDescriptor,
  Filter,
  FindCursor,
  GenericDeleteManyResult,
  GenericDeleteOneOptions,
  GenericDeleteOneResult,
  GenericFindOneAndDeleteOptions,
  GenericFindOneAndReplaceOptions,
  GenericFindOneAndUpdateOptions,
  GenericFindOneOptions,
  GenericFindOptions,
  GenericReplaceOneOptions,
  GenericUpdateManyOptions,
  GenericUpdateOneOptions,
  GenericUpdateResult,
  SomeDoc,
  SomeRow,
  Table,
  UpdateFilter,
} from '@/src/documents/index.js';
import { CollectionDeleteManyError, CollectionUpdateManyError, DataAPIResponseError } from '@/src/documents/index.js';
import type { nullish, WithTimeout } from '@/src/lib/index.js';
import { insertManyOrdered, insertManyUnordered } from '@/src/documents/commands/helpers/insertion.js';
import { coalesceUpsertIntoUpdateResult, mkUpdateResult } from '@/src/documents/commands/helpers/updates.js';
import { mkRespErrorFromResponse } from '@/src/documents/errors.js';
import { normalizedSort } from '@/src/documents/utils.js';
import { mkDistinctPathExtractor, pullSafeProjection4Distinct } from '@/src/documents/commands/helpers/distinct.js';
import stableStringify from 'safe-stable-stringify';
import type { GenericInsertOneResult } from '@/src/documents/commands/types/insert/insert-one.js';
import type { GenericInsertManyResult } from '@/src/documents/commands/types/insert/insert-many.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';

/**
 * @internal
 */
export class CommandImpls<ID> {
  private readonly _httpClient: DataAPIHttpClient;
  private readonly _serdes: SerDes;
  private readonly _tOrC: Table<SomeRow> | Collection;

  constructor(tOrC: Table<SomeRow> | Collection, httpClient: DataAPIHttpClient, serdes: SerDes) {
    this._httpClient = httpClient;
    this._serdes = serdes;
    this._tOrC = tOrC;
  }

  public async insertOne(_document: SomeDoc, options: WithTimeout<'generalMethodTimeoutMs'> | nullish): Promise<GenericInsertOneResult<ID>> {
    const document = this._serdes.serialize(_document, SerDesTarget.Record);

    const command = mkBasicCmd('insertOne', {
      document: document[0],
    });

    const raw = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: document[1],
    });

    return {
      insertedId: this._serdes.deserialize(raw.status!.insertedIds[0], raw, SerDesTarget.InsertedId),
    };
  }

  public async insertMany(docs: readonly SomeDoc[], options: CollectionInsertManyOptions | nullish, err: new (descs: DataAPIDetailedErrorDescriptor[]) => DataAPIResponseError): Promise<GenericInsertManyResult<ID>> {
    const chunkSize = options?.chunkSize ?? 50;
    const timeoutManager = this._httpClient.tm.multipart('generalMethodTimeoutMs', options);

    const insertedIds = (options?.ordered)
      ? await insertManyOrdered(this._httpClient, this._serdes, docs, chunkSize, timeoutManager, err)
      : await insertManyUnordered(this._httpClient, this._serdes, docs, options?.concurrency ?? 8, chunkSize, timeoutManager, err);

    return {
      insertedCount: insertedIds.length,
      insertedIds: insertedIds as ID[],
    };
  }

  public async updateOne(_filter: Filter, _update: UpdateFilter, options?: GenericUpdateOneOptions): Promise<GenericUpdateResult<ID, 0 | 1>> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const update = this._serdes.serialize(_update, SerDesTarget.Update);

    const command = mkCmdWithSortProj('updateOne', options, {
      filter: filter[0],
      update: update[0],
      options: {
        upsert: options?.upsert,
      },
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1] || update[1],
    });

    return coalesceUpsertIntoUpdateResult(mkUpdateResult(resp), resp);
  }

  public async updateMany(_filter: Filter, _update: UpdateFilter, options?: GenericUpdateManyOptions): Promise<GenericUpdateResult<ID, number>> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const update = this._serdes.serialize(_update, SerDesTarget.Update);

    const command = mkBasicCmd('updateMany', {
      filter: filter[0],
      update: update[0],
      options: {
        pageState: undefined as string | undefined,
        upsert: options?.upsert,
      },
    });

    const timeoutManager = this._httpClient.tm.multipart('generalMethodTimeoutMs', options);
    const commonResult = mkUpdateResult<number>();
    let resp;

    try {
      while (!resp || resp.status?.nextPageState) {
        resp = await this._httpClient.executeCommand(command, {
          bigNumsPresent: filter[1] || update[1],
          timeoutManager,
        });

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

      throw mkRespErrorFromResponse(CollectionUpdateManyError, command, raw, {
        partialResult: { ...commonResult, upsertedCount: raw.status?.upsertedCount ?? 0 },
      });
    }

    return coalesceUpsertIntoUpdateResult(commonResult, resp);
  }

  public async replaceOne(_filter: Filter, _replacement: SomeDoc, options?: GenericReplaceOneOptions): Promise<GenericUpdateResult<ID, 0 | 1>> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const replacement = this._serdes.serialize(_replacement, SerDesTarget.Record);

    const command = mkCmdWithSortProj('findOneAndReplace', options, {
      filter: filter[0],
      replacement: replacement[0],
      options: {
        returnDocument: 'before',
        upsert: options?.upsert,
      },
      projection: { '*': 0 },
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1] || replacement[1],
    });

    return coalesceUpsertIntoUpdateResult(mkUpdateResult(resp), resp);
  }

  public async deleteOne(_filter: Filter, options?: GenericDeleteOneOptions): Promise<GenericDeleteOneResult> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = mkCmdWithSortProj('deleteOne', options, {
      filter: filter[0],
    });

    const deleteOneResp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1],
    });

    return {
      deletedCount: deleteOneResp.status?.deletedCount,
    };
  }

  public async deleteMany(_filter: Filter, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<GenericDeleteManyResult> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = mkBasicCmd('deleteMany', {
      filter: filter[0],
    });

    const isDeleteAll = Object.keys(command.filter ?? {}).length === 0;

    const timeoutManager = this._httpClient.tm.multipart('generalMethodTimeoutMs', options);
    let resp, numDeleted = 0;

    try {
      while (!resp || resp.status?.moreData) {
        resp = await this._httpClient.executeCommand(command, {
          timeoutManager,
          bigNumsPresent: filter[1],
          extraLogInfo: isDeleteAll ? { deleteAll: true } : undefined,
        });
        numDeleted += resp.status?.deletedCount ?? 0;
      }
    } catch (e) {
      if (!(e instanceof DataAPIResponseError)) {
        throw e;
      }

      const desc = e.detailedErrorDescriptors[0];

      throw mkRespErrorFromResponse(CollectionDeleteManyError, command, desc.rawResponse, {
        partialResult: {
          deletedCount: numDeleted + (desc.rawResponse.status?.deletedCount ?? 0),
        },
      });
    }

    return {
      deletedCount: numDeleted,
    };
  }

  public find<Cursor extends FindCursor<SomeDoc>>(filter: Filter, options: GenericFindOptions | undefined, cursor: new (...args: ConstructorParameters<typeof FindCursor<SomeDoc>>) => Cursor): Cursor {
    if (options?.sort) {
      options.sort = normalizedSort(options.sort);
    }
    return new cursor(this._tOrC, this._serdes, this._serdes.serialize(structuredClone(filter), SerDesTarget.Filter), structuredClone(options));
  }

  public async findOne<Schema>(_filter: Filter, options?: GenericFindOneOptions): Promise<Schema | null> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = mkCmdWithSortProj('findOne', options, {
      filter: filter[0],
      options: {
        includeSimilarity: options?.includeSimilarity,
      },
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1],
    });

    return this._serdes.deserialize(resp.data?.document, resp, SerDesTarget.Record);
  }

  public async findOneAndReplace<Schema extends SomeDoc>(_filter: Filter, _replacement: SomeDoc, options?: GenericFindOneAndReplaceOptions): Promise<Schema | null> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const replacement = this._serdes.serialize(_replacement, SerDesTarget.Record);

    const command = mkCmdWithSortProj('findOneAndReplace', options, {
      filter: filter[0],
      replacement: replacement[0],
      options: {
        returnDocument: options?.returnDocument,
        upsert: options?.upsert,
      },
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1] || replacement[1],
    });

    return resp.data!.document;
  }

  public async findOneAndDelete<Schema extends SomeDoc>(_filter: Filter, options?: GenericFindOneAndDeleteOptions): Promise<Schema | null> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = mkCmdWithSortProj('findOneAndDelete', options, {
      filter: filter[0],
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1],
    });

    return resp.data!.document;
  }

  public async findOneAndUpdate<Schema extends SomeDoc>(_filter: Filter, _update: SomeDoc, options?: GenericFindOneAndUpdateOptions): Promise<Schema | null> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const update = this._serdes.serialize(_update, SerDesTarget.Update);

    const command = mkCmdWithSortProj('findOneAndUpdate', options, {
      filter: filter[0],
      update: update[0],
      options: {
        returnDocument: options?.returnDocument,
        upsert: options?.upsert,
      },
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1] || update[1],
    });

    return resp.data!.document;
  }

  public async distinct(key: string, filter: SomeDoc, options: WithTimeout<'generalMethodTimeoutMs'> | undefined, mkCursor: new (...args: ConstructorParameters<typeof FindCursor<SomeDoc>>) => FindCursor<SomeDoc>): Promise<any[]> {
    const projection = pullSafeProjection4Distinct(key);
    const cursor = this.find(filter, { projection: { _id: 0, [projection]: 1 }, timeout: options?.timeout }, mkCursor);

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

  public async countDocuments(_filter: Filter, upperBound: number, options: WithTimeout<'generalMethodTimeoutMs'> | undefined, error: new (count: number, hitLimit: boolean) => Error): Promise<number> {
    if (!upperBound) {
      throw new Error('upperBound is required');
    }

    if (upperBound < 0) {
      throw new Error('upperBound must be >= 0');
    }

    const [filter, bigNumsPresent] = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = mkBasicCmd('countDocuments', {
      filter: filter,
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      extraLogInfo: { upperBound },
      bigNumsPresent,
    });

    if (resp.status?.moreData) {
      throw new error(resp.status.count, true);
    }

    if (resp.status?.count > upperBound) {
      throw new error(upperBound, false);
    }

    return resp.status?.count;
  }

  public async estimatedDocumentCount(options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<number> {
    const command = mkBasicCmd('estimatedDocumentCount', {});

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
    });

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
