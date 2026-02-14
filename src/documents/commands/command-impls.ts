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
  Filter,
  FindAndRerankCursor,
  FindCursor,
  GenericDeleteManyResult,
  GenericDeleteOneOptions,
  GenericDeleteOneResult,
  GenericFindAndRerankOptions,
  GenericFindOneAndDeleteOptions,
  GenericFindOneAndReplaceOptions,
  GenericFindOneAndUpdateOptions,
  GenericFindOneOptions,
  GenericFindOptions,
  GenericReplaceOneOptions,
  GenericUpdateManyOptions,
  GenericUpdateOneOptions,
  GenericUpdateResult, Projection,
  SomeDoc,
  SomeId,
  SomeRow,
  Table,
  UpdateFilter,
} from '@/src/documents/index.js';
import type { nullish, CommandOptions } from '@/src/lib/index.js';
import type { InsertManyErrorConstructor } from '@/src/documents/commands/helpers/insertion.js';
import { insertManyOrdered, insertManyUnordered } from '@/src/documents/commands/helpers/insertion.js';
import { coalesceUpsertIntoUpdateResult, mkUpdateResult } from '@/src/documents/commands/helpers/updates.js';
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
  private readonly _parent: Table<SomeRow> | Collection;

  constructor(parent: Table<SomeRow> | Collection, httpClient: DataAPIHttpClient, serdes: SerDes) {
    this._httpClient = httpClient;
    this._serdes = serdes;
    this._parent = parent;
  }

  public async insertOne(_document: SomeDoc, options: CommandOptions<{ timeout: 'generalMethodTimeoutMs' }> | nullish): Promise<GenericInsertOneResult<ID>> {
    const document = this._serdes.serialize(_document, SerDesTarget.Record);

    const command = this._mkBasicCmd('insertOne', {
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

  public async insertMany(docs: readonly SomeDoc[], options: CollectionInsertManyOptions | nullish, err: InsertManyErrorConstructor): Promise<GenericInsertManyResult<ID>> {
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

    const command = this._mkCmdWithSortProj('updateOne', options, {
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

    return coalesceUpsertIntoUpdateResult(this._serdes, mkUpdateResult(resp), resp);
  }

  public async updateMany(_filter: Filter, _update: UpdateFilter, options: GenericUpdateManyOptions | nullish, mkError: (e: unknown, result: GenericUpdateResult<SomeId, number>) => Error): Promise<GenericUpdateResult<ID, number>> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const update = this._serdes.serialize(_update, SerDesTarget.Update);

    const command = this._mkBasicCmd('updateMany', {
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

        command.updateMany.options.pageState = resp.status?.nextPageState;
        commonResult.modifiedCount += resp.status?.modifiedCount;
        commonResult.matchedCount += resp.status?.matchedCount;
      }
    } catch (e) {
      throw mkError(e, coalesceUpsertIntoUpdateResult(this._serdes, commonResult, {}));
    }

    return coalesceUpsertIntoUpdateResult(this._serdes, commonResult, resp);
  }

  public async replaceOne(_filter: Filter, _replacement: SomeDoc, options?: GenericReplaceOneOptions): Promise<GenericUpdateResult<ID, 0 | 1>> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const replacement = this._serdes.serialize(_replacement, SerDesTarget.Record);

    const command = this._mkCmdWithSortProj('findOneAndReplace', options, {
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

    return coalesceUpsertIntoUpdateResult(this._serdes, mkUpdateResult(resp), resp);
  }

  public async deleteOne(_filter: Filter, options?: GenericDeleteOneOptions): Promise<GenericDeleteOneResult> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = this._mkCmdWithSortProj('deleteOne', options, {
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

  public async deleteMany(_filter: Filter, options: CommandOptions<{ timeout: 'generalMethodTimeoutMs' }> | nullish, mkError: (e: unknown, result: GenericDeleteManyResult) => Error): Promise<GenericDeleteManyResult> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = this._mkBasicCmd('deleteMany', {
      filter: filter[0],
    });

    const isDeleteAll = Object.keys(_filter).length === 0;

    const timeoutManager = this._httpClient.tm.multipart('generalMethodTimeoutMs', options);
    let resp, numDeleted = 0;

    try {
      while (!resp || resp.status?.moreData) {
        resp = await this._httpClient.executeCommand(command, {
          timeoutManager,
          bigNumsPresent: filter[1],
          extraLogInfo: isDeleteAll ? { deleteAll: true } : undefined,
        });
        /* c8 ignore next: don't think it's possible for deletedCount to be undefined, but just in case */
        numDeleted += resp.status?.deletedCount ?? 0;
      }
    } catch (e) {
      throw mkError(e, { deletedCount: numDeleted });
    }

    return {
      deletedCount: numDeleted,
    };
  }

  public find<Cursor extends FindCursor<SomeDoc>>(filter: Filter, options: GenericFindOptions | undefined, cursor: new (...args: ConstructorParameters<typeof FindCursor<SomeDoc>>) => Cursor): Cursor {
    return new cursor(this._parent, this._serdes, this._serdes.serialize(structuredClone(filter), SerDesTarget.Filter), structuredClone(options));
  }

  public findAndRerank<Cursor extends FindAndRerankCursor<SomeDoc>>(filter: Filter, options: GenericFindAndRerankOptions | undefined, cursor: new (...args: ConstructorParameters<typeof FindAndRerankCursor<SomeDoc>>) => Cursor): Cursor {
    return new cursor(this._parent, this._serdes, this._serdes.serialize(structuredClone(filter), SerDesTarget.Filter), structuredClone(options));
  }

  public async findOne<Schema>(_filter: Filter, options?: GenericFindOneOptions): Promise<Schema | null> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = this._mkCmdWithSortProj('findOne', options, {
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

    const command = this._mkCmdWithSortProj('findOneAndReplace', options, {
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

    return this._serdes.deserialize(resp.data!.document, resp, SerDesTarget.Record);
  }

  public async findOneAndDelete<Schema extends SomeDoc>(_filter: Filter, options?: GenericFindOneAndDeleteOptions): Promise<Schema | null> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = this._mkCmdWithSortProj('findOneAndDelete', options, {
      filter: filter[0],
    });

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
      bigNumsPresent: filter[1],
    });

    return this._serdes.deserialize(resp.data!.document, resp, SerDesTarget.Record);
  }

  public async findOneAndUpdate<Schema extends SomeDoc>(_filter: Filter, _update: SomeDoc, options?: GenericFindOneAndUpdateOptions): Promise<Schema | null> {
    const filter = this._serdes.serialize(_filter, SerDesTarget.Filter);
    const update = this._serdes.serialize(_update, SerDesTarget.Update);

    const command = this._mkCmdWithSortProj('findOneAndUpdate', options, {
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

    return this._serdes.deserialize(resp.data!.document, resp, SerDesTarget.Record);
  }

  public async distinct(key: string, filter: SomeDoc, options: CommandOptions<{ timeout: 'generalMethodTimeoutMs' }> | undefined, mkCursor: new (...args: ConstructorParameters<typeof FindCursor<SomeDoc>>) => FindCursor<SomeDoc>, baseProjection: Projection): Promise<any[]> {
    const projection = pullSafeProjection4Distinct(key);
    /* c8 ignore next: not sure why this is being flagged as not run during tests, but it is */
    const cursor = this.find(filter, { projection: { ...baseProjection, [projection]: 1 }, timeout: options?.timeout }, mkCursor);

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

  public async countDocuments(_filter: Filter, upperBound: number, options: CommandOptions<{ timeout: 'generalMethodTimeoutMs' }> | undefined, error: new (count: number, hitLimit: boolean) => Error): Promise<number> {
    if (!upperBound) {
      throw new Error('upperBound is required');
    }

    if (upperBound < 0) {
      throw new Error('upperBound must be >= 0');
    }

    const [filter, bigNumsPresent] = this._serdes.serialize(_filter, SerDesTarget.Filter);

    const command = this._mkBasicCmd('countDocuments', {
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

  public async estimatedDocumentCount(options?: CommandOptions<{ timeout: 'generalMethodTimeoutMs' }>): Promise<number> {
    const command = this._mkBasicCmd('estimatedDocumentCount', {});

    const resp = await this._httpClient.executeCommand(command, {
      timeoutManager: this._httpClient.tm.single('generalMethodTimeoutMs', options),
    });

    return resp.status?.count;
  }

  private _mkBasicCmd(name: string, body: SomeDoc) {
    return { [name]: body };
  };

  private _mkCmdWithSortProj(name: string, options: { sort?: SomeDoc, projection?: SomeDoc } | nullish, body: SomeDoc) {
    const command = this._mkBasicCmd(name, body);

    if (options) {
      if (options.sort && Object.keys(options.sort).length > 0) {
        // body.sort = options.sort;
        body.sort = this._serdes.serialize(options.sort, SerDesTarget.Sort)[0];
      }

      if (options.projection && Object.keys(options.projection).length > 0) {
        body.projection = options.projection;
      }
    }

    return command;
  };
}
