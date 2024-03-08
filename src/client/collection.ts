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
import { setDefaultIdForInsert, setDefaultIdForUpsert, withoutFields } from './utils';
import { InsertOneCommand, InsertOneResult } from '@/src/client/types/insert/insert-one';
import {
  InsertManyCommand,
  insertManyOptionKeys,
  InsertManyOptions,
  InsertManyResult
} from '@/src/client/types/insert/insert-many';
import {
  UpdateOneCommand,
  updateOneOptionKeys,
  UpdateOneOptions,
  UpdateOneResult,
} from '@/src/client/types/update/update-one';
import {
  UpdateManyCommand,
  updateManyOptionKeys,
  UpdateManyOptions,
  UpdateManyResult
} from '@/src/client/types/update/update-many';
import { DeleteOneCommand, DeleteOneOptions, DeleteOneResult } from '@/src/client/types/delete/delete-one';
import { DeleteManyCommand, DeleteManyResult } from '@/src/client/types/delete/delete-many';
import { FindOptions } from '@/src/client/types/find/find';
import { ModifyResult } from '@/src/client/types/find/find-common';
import { FindOneCommand, FindOneOptions, findOneOptionsKeys } from '@/src/client/types/find/find-one';
import { FindOneAndDeleteCommand, FindOneAndDeleteOptions } from '@/src/client/types/find/find-one-delete';
import {
  FindOneAndUpdateCommand,
  FindOneAndUpdateOptions,
  findOneAndUpdateOptionsKeys
} from '@/src/client/types/find/find-one-update';
import {
  FindOneAndReplaceCommand,
  FindOneAndReplaceOptions,
  findOneAndReplaceOptionsKeys
} from '@/src/client/types/find/find-one-replace';
import { Filter } from '@/src/client/types/filter';
import { UpdateFilter } from '@/src/client/types/update-filter';
import { Flatten, FoundDoc, NoId, WithId } from '@/src/client/types/utils';
import { SomeDoc } from '@/src/client/document';
import { Db } from '@/src/client/db';
import { FindCursorV2 } from '@/src/client/cursor-v2';
import { ToDotNotation } from '@/src/client/types/dot-notation';
import { CollectionOptions } from '@/src/client/types/collections/collection-options';
import { BaseOptions } from '@/src/client/types/common';
import {
  DataAPIError,
  InsertManyOrderedError,
  InsertManyUnorderedError,
  TooManyDocsToCountError
} from '@/src/client/errors';
import { ReplaceOneOptions, ReplaceOneResult } from '@/src/client/types/update/replace-one';

/**
 * Represents the interface to a collection in the database.
 *
 * **Shouldn't be directly instantiated, but rather created via {@link Db.createCollection},
 * or connected to using {@link Db.collection}**.
 *
 * Typed as `Collection<Schema>` where `Schema` is the type of the documents in the collection.
 * Operations on the collection will be strongly typed if a specific schema is provided, otherwise
 * remained largely weakly typed if no type is provided, which may be preferred for dynamic data
 * access & operations.
 *
 * @example
 * ```typescript
 * const collection = await db.createCollection<PersonSchema>('my_collection');
 * await collection.insertOne({ _id: '1', name: 'John Doe' });
 * await collection.drop();
 * ```
 *
 * @see SomeDoc
 * @see VectorDoc
 */
export class Collection<Schema extends SomeDoc = SomeDoc> {
  private readonly _collectionName: string;
  private readonly _httpClient: HTTPClient;
  private readonly _db: Db

  constructor(db: Db, httpClient: HTTPClient, name: string) {
    if (!name) {
      throw new Error('collection name is required');
    }

    this._httpClient = httpClient.cloneShallow();
    this._httpClient.collection = name;

    this._collectionName = name;
    this._db = db;
  }

  /**
   * @return The name of the collection.
   */
  get collectionName(): string {
    return this._collectionName;
  }

  /**
   * @return The namespace (aka keyspace) of the parent database.
   */
  get namespace(): string {
    return this._db.namespace;
  }

  /**
   * Inserts a single document into the collection.
   *
   * If the document does not contain an `_id` field, an ObjectId string will be generated on the client and assigned to the
   * document. This generation will mutate the document.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.insertOne({ name: 'Jane Doe' }); // _id will be generated
   * ```
   *
   * @param document - The document to insert.
   *
   * @param options - The options for the operation.
   */
  async insertOne(document: Schema, options?: BaseOptions): Promise<InsertOneResult> {
    setDefaultIdForInsert(document);

    const command: InsertOneCommand = {
      insertOne: { document },
    }

    const resp = await this._httpClient.executeCommand(command, options);

    return {
      insertedId: resp.status?.insertedIds[0],
    };
  }

  /**
   * Inserts many documents into the collection.
   *
   * **NB. This function paginates the insertion of documents in chunks to avoid running into insertion limits. This
   * means multiple requests will be made to the server, and the operation may not be atomic.**
   *
   * If any document does not contain an `_id` field, an ObjectId will be generated on the client and assigned to the
   * document. This generation will mutate the document.
   *
   * You can set the `ordered` option to `true` to stop the operation after the first error, otherwise all documents
   * may be parallelized and processed in arbitrary order.
   *
   * If an insertion error occurs, the operation will throw either an `InsertManyOrderedError` or `InsertManyUnorderedError`
   * depending on the value of the `ordered` option.
   *
   * *If the operation is not due to an insertion error, e.g. a `5xx` error or network error, the operation will throw the
   * underlying error.*
   *
   * *In case of an unordered request, if the error was a simple insertion error, a `InsertManyUnorderedError` will be
   * thrown after every document has been attempted to be inserted. If it was a `5xx` or similar, the error will be thrown
   * immediately.*
   *
   * You can set the `parallel` option to control how many network requests are made in parallel on unordered
   * insertions. Defaults to `8`.
   *
   * You can set the `chunkSize` option to control how many documents are inserted in each network request. Defaults to `20`,
   * the Data API limit. If you have large documents, you may find it beneficial to reduce this number and increase concurrency.
   *
   * @example
   * ```typescript
   * try {
   *   await collection.insertMany([
   *     { _id: '1', name: 'John Doe' },
   *     { name: 'Jane Doe' }, // _id will be generated
   *   ]);
   * } catch (e) {
   *   if (e instanceof InsertManyUnorderedError) {
   *     console.log(e.insertedIds);
   *     console.log(e.failedIds);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * try {
   *   await collection.insertMany([
   *     { _id: '1', name: 'John Doe' },
   *     { name: 'Jane Doe' }, // _id will be generated
   *   ], { ordered: true });
   * } catch (e) {
   *   if (e instanceof InsertManyOrderedError) {
   *     console.log(e.insertedIds);
   *   }
   * }
   * ```
   *
   * @param documents - The documents to insert.
   * @param options - The options for the operation.
   *
   * @throws InsertManyOrderedError - If the `ordered` option is `true` and the operation fails.
   * @throws InsertManyUnorderedError - If the `ordered` option is `false` and the operation fails.
   */
  async insertMany(documents: Schema[], options?: InsertManyOptions): Promise<InsertManyResult> {
    const chunkSize = options?.chunkSize ?? 20;

    for (let i = 0, n = documents.length; i < n; i++) {
      setDefaultIdForInsert(documents[i]);
    }

    const insertedIds = (options?.ordered)
      ? await insertManyOrdered(this._httpClient, documents, chunkSize)
      : await insertManyUnordered(this._httpClient, documents, options?.parallel ?? 8, chunkSize);

    return {
      insertedCount: insertedIds.length,
      insertedIds: insertedIds,
    }
  }

  /**
   * Updates a single document in the collection.
   *
   * You can upsert a document by setting the `upsert` option to `true`.
   *
   * You can also specify a sort option to determine which document to update if multiple documents match the filter.
   *
   * @example
   * ```typescript
   * await collection.insetOne({ _id: '1', name: 'John Doe' });
   * await collection.updateOne({ _id: '1' }, { $set: { name: 'Jane Doe' } });
   * ```
   *
   * @param filter - A filter to select the document to update.
   * @param update - The update to apply to the selected document.
   * @param options - The options for the operation.
   */
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

    const resp = await this._httpClient.executeCommand(command, options, updateOneOptionKeys);

    const commonResult = {
      modifiedCount: resp.status?.modifiedCount,
      matchedCount: resp.status?.matchedCount,
    } as const;

    return (resp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: resp.status?.upsertedId,
        upsertedCount: 1,
      }
      : commonResult;
  }

  /**
   * Updates **up to twenty** documents in the collection.
   *
   * Will throw a {@link AstraClientError} to indicate if more documents are found to update.
   *
   * You can upsert documents by setting the `upsert` option to `true`.
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe', car: 'Renault Twizy' },
   *   { car: 'BMW 330i' },
   *   { car: 'McLaren 4x4 SUV' },
   * ]);
   *
   * await collection.updateMany({
   *   name: { $exists: false }
   * }, {
   *   $set: { name: 'unknown' }
   * });
   * ```
   *
   * @param filter - A filter to select the documents to update.
   * @param update - The update to apply to the selected documents.
   * @param options - The options for the operation.
   */
  async updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateManyOptions): Promise<UpdateManyResult> {
    const command: UpdateManyCommand = {
      updateMany: {
        filter,
        update,
        options,
      },
    };

    setDefaultIdForUpsert(command.updateMany);

    const updateManyResp = await this._httpClient.executeCommand(command, options, updateManyOptionKeys);

    if (updateManyResp.status?.moreData) {
      throw new AstraClientError(
        `More than ${updateManyResp.status?.modifiedCount} records found for update by the server`,
        command,
      );
    }

    const commonResult = {
      modifiedCount: updateManyResp.status?.modifiedCount,
      matchedCount: updateManyResp.status?.matchedCount,
    } as const;

    return (updateManyResp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: updateManyResp.status?.upsertedId,
        upsertedCount: 1,
      }
      : commonResult;
  }

  /**
   * Replaces a single document in the collection.
   *
   * You can upsert a document by setting the `upsert` option to `true`.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.replaceOne({ _id: '1' }, { name: 'Jane Doe' });
   * ```
   *
   * @param filter - A filter to select the document to replace.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for the operation.
   */
  async replaceOne(filter: Filter<Schema>, replacement: NoId<Schema>, options?: ReplaceOneOptions): Promise<ReplaceOneResult> {
    const command: FindOneAndReplaceCommand = {
      findOneAndReplace: {
        filter,
        replacement,
        options: { ...options, returnDocument: 'before' },
      },
    };

    setDefaultIdForUpsert(command.findOneAndReplace, true);

    const resp = await this._httpClient.executeCommand(command, options, findOneAndReplaceOptionsKeys);

    const commonResult = {
      modifiedCount: resp.status?.modifiedCount,
      matchedCount: resp.status?.matchedCount,
    } as const;

    return (resp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: resp.status?.upsertedId,
        upsertedCount: 1,
      }
      : commonResult;
  }

  /**
   * Deletes a single document from the collection.
   *
   * You can specify a `sort` option to determine which document to delete if multiple documents match the filter.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.deleteOne({ _id: '1' });
   * ```
   *
   * @param filter - A filter to select the document to delete.
   * @param options - The options for the operation.
   */
  async deleteOne(filter: Filter<Schema> = {}, options?: DeleteOneOptions<Schema>): Promise<DeleteOneResult> {
    const command: DeleteOneCommand = {
      deleteOne: { filter },
    };

    if (options?.sort) {
      command.deleteOne.sort = options.sort;
    }

    const deleteOneResp = await this._httpClient.executeCommand(command, options);

    return {
      deletedCount: deleteOneResp.status?.deletedCount,
    };
  }

  /**
   * Deletes many documents from the collection.
   *
   * **NB. This function paginates the deletion of documents in chunks to avoid running into insertion limits. This
   * means multiple requests will be made to the server, and the operation may not be atomic.**
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe' },
   *   { name: 'Jane Doe' },
   * ]);
   *
   * await collection.deleteMany({ name: 'John Doe' });
   * ```
   *
   * @param filter - A filter to select the documents to delete.
   */
  async deleteMany(filter: Filter<Schema> = {}): Promise<DeleteManyResult> {
    const command: DeleteManyCommand = {
      deleteMany: { filter },
    };

    let resp;
    let numDeleted = 0;

    while (!resp || resp.status?.moreData) {
      resp = await this._httpClient.executeCommand(command);
      numDeleted += resp.status?.deletedCount ?? 0;
    }

    return {
      deletedCount: numDeleted,
    };
  }

  find<GetSim extends boolean = false>(filter: Filter<Schema>, options?: FindOptions<Schema, GetSim>): FindCursor<FoundDoc<Schema, GetSim>> {
    return new FindCursor(this._httpClient, filter, options) as any;
  }

  findV2<GetSim extends boolean = false>(filter: Filter<Schema>, options?: FindOptions<Schema, GetSim>): FindCursorV2<FoundDoc<Schema, GetSim>> {
    return new FindCursorV2(this.namespace, this._httpClient, filter, options) as any;
  }

  async distinct<Key extends keyof ToDotNotation<FoundDoc<Schema, GetSim>> & string, GetSim extends boolean = false>(key: Key, filter: Filter<Schema> = {}, _?: FindOptions<Schema, GetSim>): Promise<Flatten<ToDotNotation<FoundDoc<Schema, GetSim>>[Key]>[]> {
    const cursor = this.findV2<GetSim>(filter, { projection: { _id: 0, [key]: 1 } });

    const seen = new Set<unknown>();
    const path = key.split('.');

    for await (const doc of cursor) {
      let value = doc as any;

      for (let i = 0, n = path.length; i < n; i++) {
        value = value[path[i]];
      }

      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (let i = 0, n = value.length; i < n; i++) {
            seen.add(value[i]);
          }
        } else {
          seen.add(value);
        }
      }
    }

    return Array.from(seen) as any;
  }

  /**
   * Finds a single document in the collection.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also specify a `projection` option to determine which fields to include in the returned document.
   *
   * If sorting by `$vector`, you can set the `includeSimilarity` option to `true` to include the similarity score in the
   * returned document as `$similarity: number`.
   *
   * @example
   * ```typescript
   * const doc = await collection.findOne({
   *   $vector: [.12, .52, .32]
   * }, {
   *   includeSimilarity: true
   * });
   *
   * console.log(doc?.$similarity);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param options - The options for the operation.
   */
  async findOne<GetSim extends boolean = false>(filter: Filter<Schema>, options?: FindOneOptions<Schema, GetSim>): Promise<FoundDoc<Schema, GetSim> | null> {
    options = { ...options };

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

    const resp = await this._httpClient.executeCommand(command, options, findOneOptionsKeys);
    return resp.data?.document;
  }

  /**
   * Finds a single document in the collection and replaces it.
   *
   * Set `returnDocument` to `'after'` to return the document as it is after the replacement, or `'before'` to return the
   * document as it was before the replacement.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `upsert` to `true` to insert a new document if no document matches the filter.
   *
   * @example
   * ```typescript
   * const doc = await collection.findOneAndReplace(
   *   { _id: '1' },
   *   { _id: '1', name: 'John Doe' },
   *   { returnDocument: 'after' }
   * );
   *
   * // Prints { _id: '1', name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for the operation.
   */
  async findOneAndReplace(
    filter: Filter<Schema>,
    replacement: NoId<Schema>,
    options: FindOneAndReplaceOptions<Schema> & { includeResultMetadata: true },
  ): Promise<ModifyResult<Schema>>

  async findOneAndReplace(
    filter: Filter<Schema>,
    replacement: NoId<Schema>,
    options: FindOneAndReplaceOptions<Schema> & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  async findOneAndReplace(filter: Filter<Schema>, replacement: NoId<Schema>, options: FindOneAndReplaceOptions<Schema>): Promise<ModifyResult<Schema> | WithId<Schema> | null> {
    options = { ...options };

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

    const resp = await this._httpClient.executeCommand(command, options, findOneAndReplaceOptionsKeys);

    return (options.includeResultMetadata)
      ? {
        value: resp.data?.document,
        ok: 1,
      }
      : resp.data?.document;
  }

  /**
   * Counts the number of documents in the collection, optionally with a filter.
   *
   * Takes in a `limit` option which dictates the maximum number of documents that may be present before a
   * {@link TooManyDocsToCountError} is thrown. If the limit is higher than the highest limit accepted by the
   * Data API, a {@link TooManyDocsToCountError} will be thrown anyway (i.e. `1000`).
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe' },
   *   { name: 'Jane Doe' },
   * ]);
   *
   * const count = await collection.countDocuments({ name: 'John Doe' }, 1000);
   * console.log(count); // 1
   *
   * // Will throw a TooManyDocsToCountError as it counts 1, but the limit is 0
   * const count = await collection.countDocuments({ name: 'John Doe' }, 0);
   * ```
   *
   * @param filter - A filter to select the documents to count. If not provided, all documents will be counted.
   * @param limit - The maximum number of documents to count.
   * @param options - The options for the operation.
   *
   * @throws TooManyDocsToCountError - If the number of documents counted exceeds the provided limit.
   */
  async countDocuments(filter: Filter<Schema>, limit: number, options?: BaseOptions): Promise<number> {
    const command = {
      countDocuments: { filter },
    };

    if (!limit) {
      throw new Error('options.limit is required');
    }

    const resp = await this._httpClient.executeCommand(command, options);

    if (resp.status?.count > limit) {
      throw new TooManyDocsToCountError(limit);
    }

    if (resp.status?.moreData) {
      throw new TooManyDocsToCountError(1000);
    }

    return resp.status?.count;
  }

  /**
   * Finds a single document in the collection and deletes it.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * const doc = await collection.findOneAndDelete({ _id: '1' });
   * console.log(doc); // The deleted document
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param options - The options for the operation.
   */
  async findOneAndDelete(
    filter: Filter<Schema>,
    options?: FindOneAndDeleteOptions<Schema> & { includeResultMetadata: true },
  ): Promise<ModifyResult<Schema>>

  async findOneAndDelete(
    filter: Filter<Schema>,
    options?: FindOneAndDeleteOptions<Schema> & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  async findOneAndDelete(filter: Filter<Schema>, options?: FindOneAndDeleteOptions<Schema>): Promise<ModifyResult<Schema> | WithId<Schema> | null> {
    const command: FindOneAndDeleteCommand = {
      findOneAndDelete: { filter },
    };

    if (options?.sort) {
      command.findOneAndDelete.sort = options.sort;
    }

    const resp = await this._httpClient.executeCommand(command, options);

    return (options?.includeResultMetadata)
      ? {
        value: resp.data?.document,
        ok: 1,
      }
      : resp.data?.document;
  }

  /**
   * Finds a single document in the collection and updates it.
   *
   * Set `returnDocument` to `'after'` to return the document as it is after the update, or `'before'` to return the
   * document as it was before the update.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `upsert` to `true` to insert a new document if no document matches the filter.
   *
   * @example
   * ```typescript
   * const doc = await collection.findOneAndUpdate(
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' } },
   *   { returnDocument: 'after' }
   * );
   *
   * // Prints { _id: '1', name: 'Jane Doe' }
   * console.log(doc);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param update - The update to apply to the selected document.
   * @param options - The options for the operation.
   */
  async findOneAndUpdate(
    filter: Filter<Schema>,
    update: UpdateFilter<Schema>,
    options: FindOneAndUpdateOptions<Schema> & { includeResultMetadata: true },
  ): Promise<ModifyResult<Schema>>

  async findOneAndUpdate(
    filter: Filter<Schema>,
    update: UpdateFilter<Schema>,
    options: FindOneAndUpdateOptions<Schema> & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  async findOneAndUpdate(filter: Filter<Schema>, update: UpdateFilter<Schema>, options: FindOneAndUpdateOptions<Schema>): Promise<ModifyResult<Schema> | WithId<Schema> | null> {
    options = { ...options };

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

    const resp = await this._httpClient.executeCommand(command, options, findOneAndUpdateOptionsKeys);

    return (options.includeResultMetadata)
      ? {
        value: resp.data?.document,
        ok: 1,
      }
      : resp.data?.document;
  }

  /**
   * @return The options that the collection was created with (i.e. the `vector` and `indexing` operations).
   */
  async options(): Promise<CollectionOptions<SomeDoc>> {
    const results = await this._db.listCollections({ nameOnly: false });

    const collection = results.find((c) => c.name === this._collectionName);

    if (!collection) {
      throw new Error(`Collection ${this._collectionName} not found`);
    }

    return collection.options ?? {};
  }

  /**
   * Drops the collection from the database.
   *
   * @example
   * ```typescript
   * const collection = await db.createCollection('my_collection');
   * await collection.drop();
   * ```
   */
  async drop(options?: BaseOptions): Promise<boolean> {
    return await this._db.dropCollection(this._collectionName, options);
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

const insertManyOrdered = async (httpClient: HTTPClient, documents: unknown[], chunkSize: number): Promise<string[]> => {
  const insertedIds: string[] = [];

  for (let i = 0, n = documents.length; i < n; i += chunkSize) {
    const slice = documents.slice(i, i + chunkSize);

    try {
      const inserted = await insertMany(httpClient, slice, true);
      insertedIds.push(...inserted);
    } catch (e) {
      if (!(e instanceof DataAPIError)) {
        throw e;
      }

      insertedIds.push(...e.status?.insertedIds ?? []);
      throw new InsertManyOrderedError(e, insertedIds);
    }
  }

  return insertedIds;
}

const insertManyUnordered = async (httpClient: HTTPClient, documents: unknown[], parallel: number, chunkSize: number): Promise<string[]> => {
  const insertedIds: string[] = [];
  let masterIndex = 0;

  const failErrors: DataAPIError[] = [];
  const failedIds: string[] = [];

  const workers = Array.from({ length: parallel }, async () => {
    while (masterIndex < documents.length) {
      const localI = masterIndex;
      const endIdx = Math.min(localI + chunkSize, documents.length);
      masterIndex += chunkSize;

      if (localI >= endIdx) {
        break;
      }

      const slice = documents.slice(localI, endIdx);

      try {
        const inserted = await insertMany(httpClient, slice, false);
        insertedIds.push(...inserted);
      } catch (e) {
        if (!(e instanceof DataAPIError)) {
          throw e;
        }

        const justInserted = e.status?.insertedIds ?? [];
        const justInsertedSet = new Set(justInserted);

        insertedIds.push(...justInserted);
        failErrors.push(e);

        for (let i = 0, n = slice.length; i < n; i++) {
          const doc = slice[i] as { _id: string };

          if (!justInsertedSet.has(doc._id)) {
            failedIds.push(doc._id);
          } else {
            justInsertedSet.delete(doc._id);
          }
        }
      }
    }
  });
  await Promise.all(workers);

  if (failErrors.length > 0) {
    throw new InsertManyUnorderedError(failErrors, insertedIds, failedIds);
  }

  return insertedIds;
}

const insertMany = async (httpClient: HTTPClient, documents: unknown[], ordered: boolean): Promise<string[]> => {
  const command: InsertManyCommand = {
    insertMany: {
      documents,
      options: { ordered },
    }
  }

  const resp = await httpClient.executeCommand(command, {}, insertManyOptionKeys);
  return resp.status?.insertedIds ?? [];
}
