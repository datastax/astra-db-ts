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

import { normalizeSort } from '../utils';
import { FindCursor } from '@/src/documents/cursor';
import {
  BulkWriteError, DataAPIDetailedErrorDescriptor,
  DataAPIResponseError,
  DeleteManyError, InsertManyError,
  mkRespErrorFromResponse,
  mkRespErrorFromResponses,
  TooManyDocumentsToCountError,
  UpdateManyError,
} from '@/src/documents/errors';
import stableStringify from 'safe-stable-stringify';
import {
  AnyBulkWriteOperation,
  BulkWriteOptions,
  BulkWriteResult,
  DeleteManyResult,
  DeleteOneOptions,
  DeleteOneResult,
  Filter,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOneOptions,
  FindOptions,
  Flatten,
  FoundDoc,
  IdOf,
  InsertManyOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  MaybeId,
  ModifyResult,
  NoId,
  ReplaceOneOptions,
  ReplaceOneResult,
  SomeDoc,
  ToDotNotation,
  UpdateFilter,
  UpdateManyOptions,
  UpdateManyResult,
  UpdateOneOptions,
  UpdateOneResult,
  WithId,
} from '@/src/documents/collections/types';
import { TimeoutManager } from '@/src/lib/api/timeout-managers';
import { DeleteManyCommand } from '@/src/documents/collections/types/delete/delete-many';
import { FindOneCommand } from '@/src/documents/collections/types/find/find-one';
import { InsertOneCommand } from '@/src/documents/collections/types/insert/insert-one';
import { UpdateOneCommand } from '@/src/documents/collections/types/update/update-one';
import { UpdateManyCommand } from '@/src/documents/collections/types/update/update-many';
import { FindOneAndReplaceCommand } from '@/src/documents/collections/types/find/find-one-replace';
import { DeleteOneCommand } from '@/src/documents/collections/types/delete/delete-one';
import { FindOneAndDeleteCommand } from '@/src/documents/collections/types/find/find-one-delete';
import { FindOneAndUpdateCommand } from '@/src/documents/collections/types/find/find-one-update';
import { InsertManyCommand, InsertManyDocumentResponse } from '@/src/documents/collections/types/insert/insert-many';
import { Mutable } from '@/src/documents/collections/types/utils';
import { CollectionNotFoundError } from '@/src/db/errors';
import { CollectionOptions, CollectionSpawnOptions, Db } from '@/src/db';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { resolveKeyspace } from '@/src/lib/utils';
import { WithTimeout } from '@/src/lib';
import { SomeId } from '@/src/documents';
import { RawDataAPIResponse } from '@/src/lib/api';

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
 * interface PersonSchema {
 *   name: string,
 *   age?: number,
 * }
 *
 * const collection = await db.createCollection<PersonSchema>('my_collection');
 * await collection.insertOne({ _id: '1', name: 'John Doe' });
 * await collection.drop();
 * ```
 *
 * @see SomeDoc
 * @see VectorDoc
 *
 * @public
 */
export class Collection<Schema extends SomeDoc = SomeDoc> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #db: Db;

  /**
   * The name of the collection.
   */
  public readonly collectionName!: string;

  /**
   * The keyspace that the collection resides in.
   */
  public readonly keyspace!: string;

  /**
   * The keyspace that the collection resides in.
   *
   * This is now a deprecated alias for the strictly equivalent {@link Collection.keyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link Collection.keyspace} instead.
   */
  public readonly namespace!: string;

  /**
   * Use {@link Db.collection} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: CollectionSpawnOptions | undefined) {
    Object.defineProperty(this, 'collectionName', {
      value: name,
      writable: false,
    });

    Object.defineProperty(this, 'keyspace', {
      value: resolveKeyspace(opts) ?? db.keyspace,
      writable: false,
    });

    Object.defineProperty(this, 'namespace', {
      value: this.keyspace,
      writable: false,
    });

    this.#httpClient = httpClient.forCollection(this.keyspace, this.collectionName, opts);
    this.#db = db;
  }

  /**
   * Inserts a single document into the collection atomically.
   *
   * If the document does not contain an `_id` field, the server will generate an id for the document. The type of the
   * id may be specified in {@link CollectionOptions.defaultId} at creation, otherwise it'll just be a UUID string. This
   * generation does not mutate the document.
   *
   * If an `_id` is provided which corresponds to a document that already exists in the collection, an error is raised,
   * and the insertion fails.
   *
   * See {@link InsertOneOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * // Insert a document with a specific ID
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.insertOne({ _id: new ObjectID(), name: 'Jane Doe' });
   * await collection.insertOne({ _id: UUID.v7(), name: 'Dane Joe' });
   *
   * // Insert a document with an autogenerated ID
   * await collection.insertOne({ name: 'Jane Doe' });
   *
   * // Insert a vector-enabled document
   * await collection.insertOne({ name: 'Jane Doe', $vector: [.12, .52, .32] });
   * await collection.insertOne({ name: 'Jane Doe', $vectorize: "Hey there!" });
   *
   * // Use the inserted ID (generated or not)
   * const resp = await collection.insertOne({ name: 'Lemmy' });
   * console.log(resp.insertedId);
   * ```
   *
   * @param document - The document to insert.
   * @param options - The options for this operation.
   *
   * @returns The ID of the inserted document.
   */
  public async insertOne(document: MaybeId<Schema>, options?: InsertOneOptions): Promise<InsertOneResult<Schema>> {
    const command: InsertOneCommand = {
      insertOne: { document },
    };

    const { vector, vectorize } = <any>options ?? {};

    if (vector) {
      command.insertOne.document = { ...command.insertOne.document, $vector: vector };
    }

    if (vectorize) {
      command.insertOne.document = { ...command.insertOne.document, $vectorize: vectorize };
    }

    const resp = await this.#httpClient.executeCommand(command, options);

    return {
      insertedId: resp.status?.insertedIds[0],
    };
  }

  /**
   * Inserts many documents into the collection.
   *
   * **NB. This function paginates the insertion of documents in chunks to avoid running into insertion limits. This
   * means multiple requests may be made to the server, and the operation may not be atomic.**
   *
   * If any document does not contain an `_id` field, the server will generate an id for the document. The type of the
   * id may be specified in {@link CollectionOptions.defaultId} at creation, otherwise it'll just be a UUID string. This
   * generation will not mutate the documents.
   *
   * If any `_id` is provided which corresponds to a document that already exists in the collection, an error is raised,
   * and the insertion (partially) fails.
   *
   * You may set the `ordered` option to `true` to stop the operation after the first error; otherwise all documents
   * may be parallelized and processed in arbitrary order, improving, perhaps vastly, performance.
   *
   * You can set the `concurrency` option to control how many network requests are made in parallel on unordered
   * insertions. Defaults to `8`.
   *
   * If a 2XX insertion error occurs, the operation will throw an {@link InsertManyError} containing the partial result.
   *
   * See {@link InsertManyOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * try {
   *   await collection.insertMany([
   *     { _id: '1', name: 'John Doe' },
   *     { name: 'Jane Doe' },
   *   ]);
   *
   *   await collection.insertMany([
   *     { _id: '1', name: 'John Doe', $vector: [.12, .52, .32] },
   *     { name: 'Jane Doe', $vectorize: "The Ace of Spades" },
   *   ], {
   *     ordered: true,
   *   });
   *
   *   const batch = Array.from({ length: 500 }, (_, i) => ({
   *     name: 'Thing #' + i,
   *   }));
   *   await collection.insertMany(batch, { concurrency: 10 });
   * } catch (e) {
   *   if (e instanceof InsertManyError) {
   *     console.log(e.insertedIds);
   *   }
   * }
   * ```
   *
   * @remarks
   * This operation is not atomic. Depending on the amount of inserted documents, and if it's ordered or not, it can
   * keep running (in a blocking way) for a macroscopic amount of time. In that case, new documents that are inserted
   * from another concurrent process/application may be inserted during the execution of this method call, and if there
   * are duplicate keys, it's not easy to predict which application will win the race.
   *
   * --
   *
   * *If a thrown exception is not due to an insertion error, e.g. a `5xx` error or network error, the operation will throw the
   * underlying error.*
   *
   * *In case of an unordered request, if the error was a simple insertion error, a `InsertManyError` will be thrown
   * after every document has been attempted to be inserted. If it was a `5xx` or similar, the error will be thrown
   * immediately.*
   *
   * @param documents - The documents to insert.
   * @param options - The options for this operation.
   *
   * @returns The IDs of the inserted documents (and the count)
   *
   * @throws InsertManyError - If the operation fails.
   */
  public async insertMany(documents: MaybeId<Schema>[], options?: InsertManyOptions): Promise<InsertManyResult<Schema>> {
    const chunkSize = options?.chunkSize ?? 50;

    const { vectors, vectorize } = <any>options ?? {};

    if (vectors) {
      if (vectors.length !== documents.length) {
        throw new Error('The number of vectors must match the number of documents');
      }

      for (let i = 0, n = documents.length; i < n; i++) {
        if (vectors[i]) {
          documents[i] = { ...documents[i], $vector: vectors[i] };
        }
      }
    }

    if (vectorize) {
      if (vectorize.length !== documents.length) {
        throw new Error('The number of vectors must match the number of documents');
      }

      for (let i = 0, n = documents.length; i < n; i++) {
        if (vectorize[i]) {
          documents[i] = { ...documents[i], $vectorize: vectorize[i] };
        }
      }
    }

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);

    const insertedIds = (options?.ordered)
      ? await insertManyOrdered<Schema>(this.#httpClient, documents, chunkSize, timeoutManager)
      : await insertManyUnordered<Schema>(this.#httpClient, documents, options?.concurrency ?? 8, chunkSize, timeoutManager);

    return {
      insertedCount: insertedIds.length,
      insertedIds: insertedIds,
    };
  }

  /**
   * Atomically updates a single document in the collection.
   *
   * If `upsert` is set to true, it will insert the document if no match is found.
   *
   * You can also specify a sort option to determine which document to update if multiple documents match the filter.
   *
   * See {@link UpdateOneOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * // Update by ID
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   *
   * await collection.updateOne(
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' }
   * });
   *
   * // Update by vector search
   * await collection.insertOne({ name: 'John Doe', $vector: [.12, .52, .32] });
   *
   * await collection.updateOne(
   *   { name: 'John Doe' },
   *   { $set: { name: 'Jane Doe', $vectorize: "Oooooh, she's a little runaway" } },
   *   { sort: { $vector: [.09, .58, .21] } }
   * );
   * ```
   *
   * @param filter - A filter to select the document to update.
   * @param update - The update to apply to the selected document.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   *
   * @see StrictFilter
   * @see StrictUpdateFilter
   * @see StrictSort
   */
  public async updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateOneOptions): Promise<UpdateOneResult<Schema>> {
    options = coalesceVectorSpecialsIntoSort(options);

    const command: UpdateOneCommand = {
      updateOne: {
        filter,
        update,
        options: {
          upsert: options?.upsert,
        },
      },
    };

    if (options?.sort) {
      command.updateOne.sort = normalizeSort(options.sort);
    }

    const resp = await this.#httpClient.executeCommand(command, options);

    const commonResult = {
      modifiedCount: resp.status?.modifiedCount,
      matchedCount: resp.status?.matchedCount,
    };

    return (resp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: resp.status.upsertedId,
        upsertedCount: 1,
      }
      : {
        ...commonResult,
        upsertedCount: 0,
      };
  }

  /**
   * Updates many documents in the collection.
   *
   * **NB. This function paginates the updating of documents in chunks to avoid running into insertion limits. This
   * means multiple requests may be made to the server, and the operation may not be atomic.**
   *
   * If `upsert` is set to true, it will insert a document if no match is found.
   *
   * You can also specify a sort option to determine which documents to update if multiple documents match the filter.
   *
   * See {@link UpdateManyOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe', car: 'Renault Twizy' },
   *   { _id: UUID.v4(), name: 'Jane Doe' },
   *   { name: 'Dane Joe' },
   * ]);
   *
   * // Will give 'Jane' and 'Dane' a car 'unknown'
   * await collection.updateMany({
   *   car: { $exists: false },
   * }, {
   *   $set: { car: 'unknown' },
   * });
   *
   * // Will upsert a document with name 'Anette' and car 'Volvo v90'
   * await collection.updateMany({
   *   name: 'Anette',
   * }, {
   *   $set: { car: 'Volvo v90' },
   * }, {
   *   upsert: true,
   * });
   * ```
   *
   * @remarks
   * This operation is not atomic. Depending on the amount of matching documents, it can keep running (in a blocking
   * way) for a macroscopic amount of time. In that case, new documents that are inserted from another concurrent process/
   * application at the same time may be updated during the execution of this method call. In other words, it cannot
   * easily be predicted whether a given newly-inserted document will be picked up by the updateMany command or not.
   *
   * @param filter - A filter to select the documents to update.
   * @param update - The update to apply to the selected documents.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   *
   * @see StrictFilter
   * @see StrictUpdateFilter
   */
  public async updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateManyOptions): Promise<UpdateManyResult<SomeDoc>> {
    const command: UpdateManyCommand = {
      updateMany: {
        filter,
        update,
        options: {
          upsert: options?.upsert,
        },
      },
    };

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);

    const commonResult = {
      modifiedCount: 0,
      matchedCount: 0,
      upsertedCount: 0 as const,
    };

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
      const desc = e.detailedErrorDescriptors[0];

      commonResult.modifiedCount += desc.rawResponse.status?.modifiedCount ?? 0;
      commonResult.matchedCount += desc.rawResponse.status?.matchedCount ?? 0;
      commonResult.upsertedCount = desc.rawResponse.status?.upsertedCount ?? 0;

      throw mkRespErrorFromResponse(UpdateManyError, command, desc.rawResponse, { partialResult: commonResult });
    }

    return (resp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: resp.status.upsertedId,
        upsertedCount: 1,
      }
      : commonResult;
  }

  /**
   * Replaces a single document in the collection.
   *
   * If `upsert` is set to true, it will insert the replacement regardless of if no match is found.
   *
   * See {@link ReplaceOneOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * await collection.insertOne({
   *   _id: '1',
   *   name: 'John Doe',
   *   $vector: [.12, .52, .32],
   * });
   *
   * // Replace by ID
   * await collection.replaceOne({ _id: '1' }, { name: 'Jane Doe' });
   *
   * // Replace by name
   * await collection.replaceOne({
   *   name: 'John Doe',
   * }, {
   *   name: 'Jane Doe',
   *   $vector: [.08, .57, .23],
   * });
   *
   * // Replace by vector
   * await collection.replaceOne({}, {
   *   name: 'Jane Doe'
   * }, {
   *   sort: { $vector: [.09, .58, .22] },
   * });
   *
   * // Upsert if no match
   * await collection.replaceOne({
   *   name: 'Lynyrd Skynyrd',
   * }, {
   *   name: 'Lenerd Skinerd',
   * }, {
   *   upsert: true,
   * });
   * ```
   *
   * @param filter - A filter to select the document to replace.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   *
   * @see StrictFilter
   * @see StrictSort
   */
  public async replaceOne(filter: Filter<Schema>, replacement: NoId<Schema>, options?: ReplaceOneOptions): Promise<ReplaceOneResult<Schema>> {
    options = coalesceVectorSpecialsIntoSort(options);

    const command: FindOneAndReplaceCommand = {
      findOneAndReplace: {
        filter,
        replacement,
        options: {
          returnDocument: 'before',
          upsert: options?.upsert,
        },
        projection: { '*': 0 },
      },
    };

    if (options?.sort) {
      command.findOneAndReplace.sort = normalizeSort(options.sort);
    }

    const resp = await this.#httpClient.executeCommand(command, options);

    const commonResult = {
      modifiedCount: resp.status?.modifiedCount,
      matchedCount: resp.status?.matchedCount,
    };

    return (resp.status?.upsertedId)
      ? {
        ...commonResult,
        upsertedId: resp.status.upsertedId,
        upsertedCount: 1,
      }
      : {
        ...commonResult,
        upsertedCount: 0,
      };
  }

  /**
   * Atomically deletes a single document from the collection.
   *
   * You can specify a `sort` option to determine which document to delete if multiple documents match the filter.
   *
   * See {@link DeleteOneOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * // Delete by _id
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.deleteOne({ _id: '1' });
   *
   * // Delete by name
   * await collection.insertOne({ name: 'Jane Doe', age: 25 });
   * await collection.insertOne({ name: 'Jane Doe', age: 33 });
   * await collection.deleteOne({ name: 'Jane Doe' }, { sort: { age: -1 } });
   *
   * // Delete by vector search
   * await collection.insertOne({ name: 'Jane Doe', $vector: [.12, .52, .32] });
   * await collection.deleteOne({}, { sort: { $vector: [.09, .58, .42] }});
   * ```
   *
   * @param filter - A filter to select the document to delete.
   * @param options - The options for this operation.
   *
   * @returns How many documents were deleted.
   *
   * @see StrictFilter
   * @see StrictSort
   */
  public async deleteOne(filter: Filter<Schema> = {}, options?: DeleteOneOptions): Promise<DeleteOneResult> {
    options = coalesceVectorSpecialsIntoSort(options);

    const command: DeleteOneCommand = {
      deleteOne: { filter },
    };

    if (options?.sort) {
      command.deleteOne.sort = normalizeSort(options.sort);
    }

    const deleteOneResp = await this.#httpClient.executeCommand(command, options);

    return {
      deletedCount: deleteOneResp.status?.deletedCount,
    };
  }

  /**
   * Deletes many documents from the collection.
   *
   * **NB. This function paginates the deletion of documents in chunks to avoid running into insertion limits. This
   * means multiple requests may be made to the server, and the operation may not be atomic.**
   *
   * **If an empty filter is passed, all documents in the collection will atomically be deleted in a single API call. Proceed with caution.**
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe' },
   *   { name: 'John Doe' },
   * ]);
   *
   * await collection.deleteMany({ name: 'John Doe' });
   * ```
   *
   * @remarks
   * This operation is not atomic. Depending on the amount of matching documents, it can keep running (in a blocking
   * way) for a macroscopic amount of time. In that case, new documents that are inserted from another concurrent process/
   * application at the same time may be deleted during the execution of this method call. In other words, it cannot
   * easily be predicted whether a given newly-inserted document will be picked up by the deleteMany command or not.
   *
   * @param filter - A filter to select the documents to delete.
   * @param options - The options for this operation.
   *
   * @returns How many documents were deleted.
   *
   * @throws Error - If an empty filter is passed.
   *
   * @see StrictFilter
   */
  public async deleteMany(filter: Filter<Schema>, options?: WithTimeout): Promise<DeleteManyResult> {
    const command: DeleteManyCommand = {
      deleteMany: { filter },
    };

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);

    let resp;
    let numDeleted = 0;

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

  /**
   * Deletes all documents from the collection.
   *
   * Unlike {@link Collection.deleteMany}, this method is atomic and will delete all documents in the collection in one go,
   * without making multiple network requests to the server.
   *
   * @remarks Use with caution. Wear a helmet. Don't say I didn't warn you.
   *
   * @param options - The options for this operation.
   *
   * @deprecated - Prefer the traditional `deleteMany({})` instead
   *
   * @returns A promise that resolves when the operation is complete.
   */
  public async deleteAll(options?: WithTimeout): Promise<void> {
    await this.deleteMany({}, options);
  }

  /**
   * Find documents on the collection, optionally matching the provided filter.
   *
   * Also accepts `sort`, `limit`, `skip`, `includeSimilarity`, and `projection` options.
   *
   * The method returns a {@link FindCursor} that can then be iterated over.
   *
   * **NB. If a *non-vector-sort* `sort` option is provided, the iteration of all documents may not be atomic**—it will
   * iterate over cursors in an approximate way, exhibiting occasional skipped or duplicate documents, with real-time
   * collection insertions/mutations being displayed.
   *
   * See {@link FindOptions} and {@link FindCursor} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { name: 'John Doe', $vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
   * ]);
   *
   * // Find by name
   * const cursor1 = collection.find({ name: 'John Doe' });
   *
   * // Returns ['John Doe']
   * console.log(await cursor1.toArray());
   *
   * // Match all docs, sorting by name
   * const cursor2 = collection.find({}, {
   *   sort: { name: 1 },
   * });
   *
   * // Returns 'Dane Joe', 'Jane Doe', 'John Doe'
   * for await (const doc of cursor2) {
   *   console.log(doc);
   * }
   *
   * // Find by vector
   * const cursor3 = collection.find({}, {
   *   sort: { $vector: [.12, .52, .32] },
   * });
   *
   * // Returns 'John Doe'
   * console.log(await cursor3.next());
   * ```
   *
   * @remarks
   * Some combinations of arguments impose an implicit upper bound on the number of documents that are returned by the
   * Data API. Namely:
   *
   * (a) Vector ANN searches cannot return more than a number of documents
   * that at the time of writing is set to 1000 items.
   *
   * (b) When using a sort criterion of the ascending/descending type,
   * the Data API will return a smaller number of documents, set to 20
   * at the time of writing, and stop there. The returned documents are
   * the top results across the whole collection according to the requested
   * criterion.
   *
   * --
   *
   * When not specifying sorting criteria at all (by vector or otherwise),
   * the cursor can scroll through an arbitrary number of documents as
   * the Data API and the client periodically exchange new chunks of documents.
   * It should be noted that the behavior of the cursor in the case documents
   * have been added/removed after the `find` was started depends on database
   * internals, and it is not guaranteed, nor excluded, that such "real-time"
   * changes in the data would be picked up by the cursor.
   *
   * @param filter - A filter to select the documents to find. If not provided, all documents will be returned.
   * @param options - The options for this operation.
   *
   * @returns A FindCursor which can be iterated over.
   *
   * @see StrictFilter
   * @see StrictSort
   * @see StrictProjection
   */
  public find(filter: Filter<Schema>, options?: FindOptions): FindCursor<FoundDoc<Schema>, FoundDoc<Schema>> {
    return new FindCursor(this.keyspace, this.#httpClient, filter as any, coalesceVectorSpecialsIntoSort(options));
  }

  /**
   * Finds a single document in the collection, if it exists.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also specify a `projection` option to determine which fields to include in the returned document.
   *
   * If performing a vector search, you can set the `includeSimilarity` option to `true` to include the similarity score
   * in the returned document as `$similarity: number`.
   *
   * See {@link FindOneOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * const doc1 = await collection.findOne({
   *   name: 'John Doe',
   * });
   *
   * // Will be undefined
   * console.log(doc1?.$similarity);
   *
   * const doc2 = await collection.findOne({}, {
   *   sort: {
   *     $vector: [.12, .52, .32],
   *   },
   *   includeSimilarity: true,
   * });
   *
   * // Will be a number
   * console.log(doc2?.$similarity);
   * ```
   *
   * @remarks
   * If you really need `skip` or `includeSortVector`, prefer using the {@link Collection.find} method instead with `limit: 1`.
   *
   * @param filter - A filter to select the document to find.
   * @param options - The options for this operation.
   *
   * @returns The found document, or `null` if no document was found.
   *
   * @see StrictFilter
   * @see StrictSort
   * @see StrictProjection
   */
  public async findOne(filter: Filter<Schema>, options?: FindOneOptions): Promise<FoundDoc<Schema> | null> {
    options = coalesceVectorSpecialsIntoSort(options);

    const command: FindOneCommand = {
      findOne: {
        filter,
        options: {
          includeSimilarity: options?.includeSimilarity,
        },
      },
    };

    if (options?.sort) {
      command.findOne.sort = normalizeSort(options.sort);
    }

    if (options?.projection && Object.keys(options.projection).length > 0) {
      command.findOne.projection = options.projection;
    }

    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.data?.document;
  }

  /**
   * Return a list of the unique values of `key` across the documents in the collection that match the provided filter.
   *
   * **NB. This is a *client-side* operation**—this effectively browses all matching documents (albeit with a
   * projection) using the logic of the {@link Collection.find} method, and collects the unique value for the
   * given `key` manually. As such, there may be performance, latency and ultimately billing implications if the
   * amount of matching documents is large.
   *
   * The key may use dot-notation to access nested fields, such as `'field'`, `'field.subfield'`, `'field.3'`,
   * `'field.3.subfield'`, etc. If lists are encountered and no numeric index is specified, all items in the list are
   * pulled.
   *
   * **Note that on complex extractions, the return type may be not as expected.** In that case, it's on the user to
   * cast the return type to the correct one.
   *
   * Distinct works with arbitrary objects as well, by creating a deterministic hash of the object and comparing it
   * with the hashes of the objects already seen. This, unsurprisingly, may not be great for performance if you have
   * a lot of records that match, so it's recommended to use distinct on simple values whenever performance or number
   * of records is a concern.
   *
   * For details on the behaviour of "distinct" in conjunction with real-time changes in the collection contents, see
   * the remarks on the `find` command.
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { letter: { value: 'a' }, car: [1] },
   *   { letter: { value: 'b' }, car: [2, 3] },
   *   { letter: { value: 'a' }, car: [2], bus: 'no' },
   * ]);
   *
   * // ['a', 'b']
   * const distinct = await collection.distinct('letter.value');
   *
   * await collection.insertOne({
   *   x: [{ y: 'Y', 0: 'ZERO' }],
   * });
   *
   * // ['Y']
   * await collection.distinct('x.y');
   *
   * // [{ y: 'Y', 0: 'ZERO' }]
   * await collection.distinct('x.0');
   *
   * // ['Y']
   * await collection.distinct('x.0.y');
   *
   * // ['ZERO']
   * await collection.distinct('x.0.0');
   * ```
   *
   * @param key - The dot-notation key to pick which values to retrieve unique
   * @param filter - A filter to select the documents to find. If not provided, all documents will be matched.
   *
   * @returns A list of all the unique values selected by the given `key`
   *
   * @see StrictFilter
   */
  public async distinct<Key extends string>(key: Key, filter: Filter<Schema> = {}): Promise<Flatten<(SomeDoc & ToDotNotation<FoundDoc<Schema>>)[Key]>[]> {
    const projection = pullSafeProjection4Distinct(key);
    const cursor = this.find(filter, { projection: { _id: 0, [projection]: 1 } });

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

  /**
   * Counts the number of documents in the collection, optionally with a filter.
   *
   * Takes in a `limit` option which dictates the maximum number of documents that may be present before a
   * {@link TooManyDocumentsToCountError} is thrown. If the limit is higher than the highest limit accepted by the
   * Data API, a {@link TooManyDocumentsToCountError} will be thrown anyway (i.e. `1000`).
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
   * // Will throw a TooManyDocumentsToCountError as it counts 1, but the limit is 0
   * const count = await collection.countDocuments({ name: 'John Doe' }, 0);
   * ```
   *
   * @remarks
   * Count operations are expensive: for this reason, the best practice is to provide a reasonable `upperBound`
   * according to the caller expectations. Moreover, indiscriminate usage of count operations for sizeable amounts
   * of documents (i.e. in the thousands and more) is discouraged in favor of alternative application-specific
   * solutions. Keep in mind that the Data API has a hard upper limit on the amount of documents it will count,
   * and that an exception will be thrown by this method if this limit is encountered.
   *
   * @param filter - A filter to select the documents to count. If not provided, all documents will be counted.
   * @param upperBound - The maximum number of documents to count.
   * @param options - The options for this operation.
   *
   * @returns The number of counted documents, if below the provided limit
   *
   * @throws TooManyDocumentsToCountError - If the number of documents counted exceeds the provided limit.
   *
   * @see StrictFilter
   */
  public async countDocuments(filter: Filter<Schema>, upperBound: number, options?: WithTimeout): Promise<number> {
    const command = {
      countDocuments: { filter },
    };

    if (!upperBound) {
      throw new Error('upperBound is required');
    }

    if (upperBound < 0) {
      throw new Error('upperBound must be >= 0');
    }

    const resp = await this.#httpClient.executeCommand(command, options);

    if (resp.status?.moreData) {
      throw new TooManyDocumentsToCountError(resp.status.count, true);
    }

    if (resp.status?.count > upperBound) {
      throw new TooManyDocumentsToCountError(upperBound, false);
    }

    return resp.status?.count;
  }

  /**
   * Gets an estimate of the count of documents in a collection.
   *
   * This operation is faster than {@link Collection.countDocuments} but may not be as accurate, and doesn't
   * accept a filter. Unlike the former, **It can handle more than 1000 documents.**
   *
   * @remarks
   * This gives a very rough estimate of the number of documents in the collection. It is not guaranteed to be
   * accurate, and should not be used as a source of truth for the number of documents in the collection.
   *
   * @param options - The options for this operation.
   *
   * @returns The estimated number of documents in the collection
   */
  public async estimatedDocumentCount(options?: WithTimeout): Promise<number> {
    const command = {
      estimatedDocumentCount: {},
    };

    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.status?.count;
  }

  /**
   * Atomically finds a single document in the collection and replaces it.
   *
   * If `upsert` is set to true, it will insert the replacement regardless of if no match is found.
   *
   * Set `returnDocument` to `'after'` to return the document as it is after the replacement, or `'before'` to return the
   * document as it was before the replacement.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `projection` to determine which fields to include in the returned document.
   *
   * If you just want the document, either omit `includeResultMetadata`, or set it to `false`.
   *
   * See {@link FindOneAndReplaceOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', band: 'ZZ Top' });
   *
   * const result = await collection.findOneAndReplace(
   *   { _id: '1' },
   *   { name: 'John Doe' },
   *   { returnDocument: 'after', includeResultMetadata: true },
   * );
   *
   * // Prints { _id: '1', name: 'John Doe' }
   * console.log(result.value);
   *
   * // Prints 1
   * console.log(result.ok);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for this operation.
   *
   * @returns The result of the operation
   *
   * @see StrictFilter
   */
  public async findOneAndReplace(
    filter: Filter<Schema>,
    replacement: NoId<Schema>,
    options: FindOneAndReplaceOptions & { includeResultMetadata: true },
  ): Promise<ModifyResult<Schema>>

  /**
   * Atomically finds a single document in the collection and replaces it.
   *
   * If `upsert` is set to true, it will insert the replacement regardless of if no match is found.
   *
   * Set `returnDocument` to `'after'` to return the document as it is after the replacement, or `'before'` to return the
   * document as it was before the replacement.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `projection` to determine which fields to include in the returned document.
   *
   * If you want the ok status along with the document, set `includeResultMetadata` to `true`.
   *
   * See {@link FindOneAndReplaceOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', band: 'ZZ Top' });
   *
   * const doc = await collection.findOneAndReplace(
   *   { _id: '1' },
   *   { name: 'John Doe' },
   *   { returnDocument: 'after', includeResultMetadata: true },
   * );
   *
   * // Prints { _id: '1', name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for this operation.
   *
   * @returns The document before/after replacement, depending on the type of `returnDocument`
   *
   * @see StrictFilter
   */
  public async findOneAndReplace(
    filter: Filter<Schema>,
    replacement: NoId<Schema>,
    options?: FindOneAndReplaceOptions & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  public async findOneAndReplace(filter: Filter<Schema>, replacement: NoId<Schema>, options?: FindOneAndReplaceOptions): Promise<ModifyResult<Schema> | WithId<Schema> | null> {
    options = coalesceVectorSpecialsIntoSort(options);

    const command: FindOneAndReplaceCommand = {
      findOneAndReplace: {
        filter,
        replacement,
        options: {
          returnDocument: options?.returnDocument,
          upsert: options?.upsert,
        },
      },
    };

    if (options?.sort) {
      command.findOneAndReplace.sort = normalizeSort(options.sort);
    }

    if (options?.projection && Object.keys(options.projection).length > 0) {
      command.findOneAndReplace.projection = options.projection;
    }

    const resp = await this.#httpClient.executeCommand(command, options);
    const document = resp.data?.document || null;

    return (options?.includeResultMetadata)
      ? {
        value: document,
        ok: 1,
      }
      : document;
  }

  /**
   * Atomically finds a single document in the collection and deletes it.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `projection` to determine which fields to include in the returned document.
   *
   * If you just want the document, either omit `includeResultMetadata`, or set it to `false`.
   *
   * See {@link FindOneAndDeleteOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   *
   * const result = await collection.findOneAndDelete(
   *   { _id: '1' },
   *   { includeResultMetadata: true, }
   * );
   *
   * // Prints { _id: '1', name: 'John Doe' }
   * console.log(result.value);
   *
   * // Prints 1
   * console.log(result.ok);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param options - The options for this operation.
   *
   * @returns The result of the operation
   *
   * @see StrictFilter
   */
  public async findOneAndDelete(
    filter: Filter<Schema>,
    options: FindOneAndDeleteOptions & { includeResultMetadata: true },
  ): Promise<ModifyResult<Schema>>

  /**
   * Atomically finds a single document in the collection and deletes it.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `projection` to determine which fields to include in the returned document.
   *
   * If you want the ok status along with the document, set `includeResultMetadata` to `true`.
   *
   * See {@link FindOneAndDeleteOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * const doc = await collection.findOneAndDelete({ _id: '1' });
   *
   * // Prints { _id: '1', name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param options - The options for this operation.
   *
   * @returns The deleted document, or `null` if no document was found.
   *
   * @see StrictFilter
   */
  public async findOneAndDelete(
    filter: Filter<Schema>,
    options?: FindOneAndDeleteOptions & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  public async findOneAndDelete(filter: Filter<Schema>, options?: FindOneAndDeleteOptions): Promise<ModifyResult<Schema> | WithId<Schema> | null> {
    options = coalesceVectorSpecialsIntoSort(options);

    const command: FindOneAndDeleteCommand = {
      findOneAndDelete: { filter },
    };

    if (options?.sort) {
      command.findOneAndDelete.sort = normalizeSort(options.sort);
    }

    if (options?.projection && Object.keys(options.projection).length > 0) {
      command.findOneAndDelete.projection = options.projection;
    }

    const resp = await this.#httpClient.executeCommand(command, options);
    const document = resp.data?.document || null;

    return (options?.includeResultMetadata)
      ? {
        value: document,
        ok: 1,
      }
      : document;
  }

  /**
   * Atomically finds a single document in the collection and updates it.
   *
   * Set `returnDocument` to `'after'` to return the document as it is after the update, or `'before'` to return the
   * document as it was before the update.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `upsert` to `true` to insert a new document if no document matches the filter.
   *
   * If you just want the document, either omit `includeResultMetadata`, or set it to `false`.
   *
   * See {@link FindOneAndUpdateOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * const result = await collection.findOneAndUpdate(
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' } },
   *   { returnDocument: 'after', includeResultMetadata: true },
   * );
   *
   * // Prints { _id: '1', name: 'Jane Doe' }
   * console.log(result.value);
   *
   * // Prints 1
   * console.log(result.ok);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param update - The update to apply to the selected document.
   * @param options - The options for this operation.
   *
   * @returns The result of the operation
   *
   * @see StrictFilter
   * @see StrictUpdateFilter
   */
  public async findOneAndUpdate(
    filter: Filter<Schema>,
    update: UpdateFilter<Schema>,
    options: FindOneAndUpdateOptions & { includeResultMetadata: true },
  ): Promise<ModifyResult<Schema>>

  /**
   * Atomically finds a single document in the collection and updates it.
   *
   * Set `returnDocument` to `'after'` to return the document as it is after the update, or `'before'` to return the
   * document as it was before the update.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `upsert` to `true` to insert a new document if no document matches the filter.
   *
   * If you want the ok status along with the document, set `includeResultMetadata` to `true`.
   *
   * See {@link FindOneAndUpdateOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * const doc = await collection.findOneAndUpdate(
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' } },
   *   { returnDocument: 'after'},
   * );
   *
   * // Prints { _id: '1', name: 'Jane Doe' }
   * console.log(doc);
   * ```
   *
   * @param filter - A filter to select the document to find.
   * @param update - The update to apply to the selected document.
   * @param options - The options for this operation.
   *
   * @returns The document before/after the update, depending on the type of `returnDocument`
   *
   * @see StrictFilter
   * @see StrictUpdateFilter
   */
  public async findOneAndUpdate(
    filter: Filter<Schema>,
    update: UpdateFilter<Schema>,
    options?: FindOneAndUpdateOptions & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  public async findOneAndUpdate(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: FindOneAndUpdateOptions): Promise<ModifyResult<Schema> | WithId<Schema> | null> {
    options = coalesceVectorSpecialsIntoSort(options);

    const command: FindOneAndUpdateCommand = {
      findOneAndUpdate: {
        filter,
        update,
        options: {
          returnDocument: options?.returnDocument,
          upsert: options?.upsert,
        },
      },
    };

    if (options?.sort) {
      command.findOneAndUpdate.sort = normalizeSort(options.sort);
    }

    if (options?.projection && Object.keys(options.projection).length > 0) {
      command.findOneAndUpdate.projection = options.projection;
    }

    const resp = await this.#httpClient.executeCommand(command, options);
    const document = resp.data?.document || null;

    return (options?.includeResultMetadata)
      ? {
        value: document,
        ok: 1,
      }
      : document;
  }

  /**
   * Execute arbitrary operations sequentially/concurrently on the collection, such as insertions, updates, replaces,
   * & deletions, **non-atomically**
   *
   * **Note: prefer not to use this method; its implementation is subject to change on short notice.**
   *
   * Each operation is treated as a separate, unrelated request to the server; it is not performed in a transaction.
   *
   * You can set the `ordered` option to `true` to stop the operations after the first error, otherwise all operations
   * may be parallelized and processed in arbitrary order, improving, perhaps vastly, performance.
   *
   * *Note that the bulkWrite being ordered has nothing to do with if the operations themselves are ordered or not.*
   *
   * If an operational error occurs, the operation will throw a {@link BulkWriteError} containing the partial result.
   *
   * *If the exception is not due to a soft `2XX` error, e.g. a `5xx` error or network error, the operation will throw
   * the underlying error.*
   *
   * *In case of an unordered request, if the error was a simple operational error, a `BulkWriteError` will be thrown
   * after every operation has been attempted. If it was a `5xx` or similar, the error will be thrown immediately.*
   *
   * You can set the `parallel` option to control how many network requests are made in parallel on unordered
   * insertions. Defaults to `8`.
   *
   * @example
   * ```typescript
   * try {
   *   // Insert a document, then delete it
   *   await collection.bulkWrite([
   *     { insertOne: { document: { _id: '1', name: 'John Doe' } } },
   *     { deleteOne: { filter: { name: 'John Doe' } } },
   *   ], { ordered: true });
   *
   *   // Insert and delete operations, will cause a data race
   *   await collection.bulkWrite([
   *     { insertOne: { document: { _id: '1', name: 'John Doe' } } },
   *     { deleteOne: { filter: { name: 'John Doe' } } },
   *   ]);
   * } catch (e) {
   *   if (e instanceof BulkWriteError) {
   *     console.log(e.insertedCount);
   *     console.log(e.deletedCount);
   *   }
   * }
   * ```
   *
   * @param operations - The operations to perform.
   * @param options - The options for this operation.
   *
   * @returns The aggregated result of the operations.
   *
   * @throws BulkWriteError - If the operation fails
   *
   * @deprecated - Prefer to just call the functions manually; this will be removed in an upcoming major release.
   */
  public async bulkWrite(operations: AnyBulkWriteOperation<Schema>[], options?: BulkWriteOptions): Promise<BulkWriteResult<Schema>> {
    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);

    return (options?.ordered)
      ? await bulkWriteOrdered(this.#httpClient, operations, timeoutManager)
      : await bulkWriteUnordered(this.#httpClient, operations, options?.concurrency ?? 8, timeoutManager);
  }

  /**
   * Get the collection options, i.e. its configuration as read from the database.
   *
   * The method issues a request to the Data API each time it is invoked, without caching mechanisms;
   * this ensures up-to-date information for usages such as real-time collection validation by the application.
   *
   * @example
   * ```typescript
   * const options = await collection.info();
   * console.log(options.vector);
   * ```
   *
   * @param options - The options for this operation.
   *
   * @returns The options that the collection was created with (i.e. the `vector` and `indexing` operations).
   */
  public async options(options?: WithTimeout): Promise<CollectionOptions<SomeDoc>> {
    const results = await this.#db.listCollections({ nameOnly: false, maxTimeMS: options?.maxTimeMS });

    const collection = results.find((c) => c.name === this.collectionName);

    if (!collection) {
      throw new CollectionNotFoundError(this.keyspace, this.collectionName);
    }

    return collection.options;
  }

  /**
   * Drops the collection from the database, including all the documents it contains.
   *
   * Once the collection is dropped, this object is still technically "usable", but any further operations on it
   * will fail at the Data API level; thus, it's the user's responsibility to make sure that the collection object
   * is no longer used.
   *
   * @example
   * ```typescript
   * const collection = await db.createCollection('my_collection');
   * await collection.drop();
   * ```
   *
   * @param options - The options for this operation.
   *
   * @returns `true` if the collection was dropped okay.
   *
   * @remarks Use with caution. Wear your safety goggles. Don't say I didn't warn you.
   */
  public async drop(options?: WithTimeout): Promise<boolean> {
    return await this.#db.dropCollection(this.collectionName, { keyspace: this.keyspace, ...options });
  }

  private get _httpClient() {
    return this.#httpClient;
  }
}

// -- Utils-------------------------------------------------------------------------------------------------

interface OptionsWithSort {
  sort?: Record<string, any>;
  vector?: number[];
  vectorize?: string;
}

const coalesceVectorSpecialsIntoSort = <T extends OptionsWithSort>(options: T | undefined): T | undefined => {
  if (options?.vector && options.vectorize) {
    throw new Error('Cannot set both vectors and vectorize options');
  }

  if (options?.vector) {
    if (options.sort) {
      throw new Error('Can\'t use both `sort` and `vector` options at once; if you need both, include a $vector key in the sort object');
    }
    return { ...options, sort: { $vector: options.vector } };
  }

  if (options?.vectorize) {
    if (options.sort) {
      throw new Error('Can\'t use both `sort` and `vectorize` options at once; if you need both, include a $vectorize key in the sort object');
    }
    return { ...options, sort: { $vectorize: options.vectorize } };
  }

  return options;
};

// -- Insert Many ------------------------------------------------------------------------------------------

const insertManyOrdered = async <Schema extends SomeDoc>(httpClient: DataAPIHttpClient, documents: unknown[], chunkSize: number, timeoutManager: TimeoutManager): Promise<IdOf<Schema>[]> => {
  const insertedIds: IdOf<Schema>[] = [];

  for (let i = 0, n = documents.length; i < n; i += chunkSize) {
    const slice = documents.slice(i, i + chunkSize);

    const [_docResp, inserted, errDesc] = await insertMany<Schema>(httpClient, slice, true, timeoutManager);
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

const insertManyUnordered = async <Schema extends SomeDoc>(httpClient: DataAPIHttpClient, documents: unknown[], concurrency: number, chunkSize: number, timeoutManager: TimeoutManager): Promise<IdOf<Schema>[]> => {
  const insertedIds: IdOf<Schema>[] = [];
  let masterIndex = 0;

  const failCommands = [] as Record<string, any>[];
  const failRaw = [] as Record<string, any>[];
  const docResps = [] as InsertManyDocumentResponse<SomeDoc>[];

  const workers = Array.from({ length: concurrency }, async () => {
    while (masterIndex < documents.length) {
      const localI = masterIndex;
      const endIdx = Math.min(localI + chunkSize, documents.length);
      masterIndex += chunkSize;

      if (localI >= endIdx) {
        break;
      }

      const slice = documents.slice(localI, endIdx);

      const [docResp, inserted, errDesc] = await insertMany<Schema>(httpClient, slice, false, timeoutManager);
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

const insertMany = async <Schema extends SomeDoc>(httpClient: DataAPIHttpClient, documents: unknown[], ordered: boolean, timeoutManager: TimeoutManager): Promise<[InsertManyDocumentResponse<Schema>[], IdOf<Schema>[], DataAPIDetailedErrorDescriptor | undefined]> => {
  const command: InsertManyCommand = {
    insertMany: {
      documents,
      options: {
        returnDocumentResponses: true,
        ordered,
      },
    },
  };

  let resp, err: DataAPIResponseError | undefined;

  try {
    resp = await httpClient.executeCommand(command, { timeoutManager });
  } catch (e) {
    if (! (e instanceof DataAPIResponseError)) {
      throw e;
    }
    resp = e.detailedErrorDescriptors[0].rawResponse;
    err = e;
  }

  const documentResponses = resp.status?.documentResponses ?? [];
  const errors = resp.errors;

  const insertedIds = [];

  for (let i = 0, n = documentResponses.length; i < n; i++) {
    const resp = documentResponses[i];

    if (resp.status === "OK") {
      insertedIds.push(resp._id);
    } else if (resp.errorIdx) {
      resp.error = errors![resp.errorIdx];
      delete resp.errorIdx;
    }
  }

  return [documentResponses, insertedIds, err?.detailedErrorDescriptors[0]];
};

// -- Bulk Write ------------------------------------------------------------------------------------------

const bulkWriteOrdered = async <Schema extends SomeDoc>(httpClient: DataAPIHttpClient, operations: AnyBulkWriteOperation<Schema>[], timeoutManager: TimeoutManager): Promise<BulkWriteResult<Schema>> => {
  const results = new BulkWriteResult<Schema>();
  let i = 0;

  try {
    for (let n = operations.length; i < n; i++) {
      await bulkWrite(httpClient, operations[i], results, i, timeoutManager);
    }
  } catch (e) {
    if (!(e instanceof DataAPIResponseError)) {
      throw e;
    }
    const desc = e.detailedErrorDescriptors[0];

    if (desc.rawResponse.status) {
      addToBulkWriteResult(results, desc.rawResponse.status, i);
    }

    throw mkRespErrorFromResponse(BulkWriteError, desc.command, desc.rawResponse, { partialResult: results });
  }

  return results;
};

const bulkWriteUnordered = async <Schema extends SomeDoc>(httpClient: DataAPIHttpClient, operations: AnyBulkWriteOperation<Schema>[], concurrency: number, timeoutManager: TimeoutManager): Promise<BulkWriteResult<Schema>> => {
  const results = new BulkWriteResult<Schema>();
  let masterIndex = 0;

  const failCommands = [] as Record<string, any>[];
  const failRaw = [] as Record<string, any>[];

  const workers = Array.from({ length: concurrency }, async () => {
    while (masterIndex < operations.length) {
      const localI = masterIndex;
      masterIndex++;

      try {
        await bulkWrite(httpClient, operations[localI], results, localI, timeoutManager);
      } catch (e) {
        if (!(e instanceof DataAPIResponseError)) {
          throw e;
        }
        const desc = e.detailedErrorDescriptors[0];

        if (desc.rawResponse.status) {
          addToBulkWriteResult(results, desc.rawResponse.status, localI);
        }

        failCommands.push(desc.command);
        failRaw.push(desc.rawResponse);
      }
    }
  });
  await Promise.all(workers);

  if (failCommands.length > 0) {
    throw mkRespErrorFromResponses(BulkWriteError, failCommands, failRaw, { partialResult: results });
  }

  return results;
};

const bulkWrite = async <Schema extends SomeDoc>(httpClient: DataAPIHttpClient, operation: AnyBulkWriteOperation<Schema>, results: BulkWriteResult<Schema>, i: number, timeoutManager: TimeoutManager): Promise<void> => {
  const command = buildBulkWriteCommand(operation);
  const resp = await httpClient.executeCommand(command, { timeoutManager });
  addToBulkWriteResult(results, resp, i);
};

const buildBulkWriteCommand = <Schema extends SomeDoc>(operation: AnyBulkWriteOperation<Schema>): Record<string, any> => {
  switch (true) {
    case 'insertOne' in operation:
      return { insertOne: { document: operation.insertOne.document } };
    case 'updateOne' in operation:
      return { updateOne: { filter: operation.updateOne.filter, update: operation.updateOne.update, options: { upsert: operation.updateOne.upsert ?? false } } };
    case 'updateMany' in operation:
      return { updateMany: { filter: operation.updateMany.filter, update: operation.updateMany.update, options: { upsert: operation.updateMany.upsert ?? false } } };
    case 'replaceOne' in operation:
      return { findOneAndReplace: { filter: operation.replaceOne.filter, replacement: operation.replaceOne.replacement, options: { upsert: operation.replaceOne.upsert ?? false } } };
    case 'deleteOne' in operation:
      return { deleteOne: { filter: operation.deleteOne.filter } };
    case 'deleteMany' in operation:
      return { deleteMany: { filter: operation.deleteMany.filter } };
    default:
      throw new Error(`Unknown bulk write operation: ${JSON.stringify(operation)}`);
  }
};

const addToBulkWriteResult = (result: BulkWriteResult<SomeDoc>, resp: RawDataAPIResponse, i: number) => {
  const asMutable = result as Mutable<BulkWriteResult<SomeDoc>>;
  const status = resp.status;

  if (status) {
    asMutable.insertedCount += status.insertedIds?.length ?? 0;
    asMutable.modifiedCount += status.modifiedCount ?? 0;
    asMutable.matchedCount += status.matchedCount ?? 0;
    asMutable.deletedCount += status.deletedCount ?? 0;

    if (status.upsertedId) {
      asMutable.upsertedCount++;
      asMutable.upsertedIds[i] = status.upsertedId;
    }
  }

  asMutable.getRawResponse().push(resp);
};

// -- Distinct --------------------------------------------------------------------------------------------

const pullSafeProjection4Distinct = (path: string): string => {
  const split = path.split('.');

  if (split.some(p => !p)) {
    throw new Error('Path cannot contain empty segments');
  }

  let i, n;
  for (i = 0, n = split.length; i < n && isNaN(+split[i]); i++) { /* empty */ }

  split.length = i;
  return split.join('.');
};

const mkDistinctPathExtractor = (path: string): (doc: SomeDoc) => any[] => {
  const values = [] as any[];

  const extract = (path: string[], index: number, value: any) => {
    if (value === undefined) {
      return;
    }

    if (index === path.length) {
      if (Array.isArray(value)) {
        values.push(...value);
      } else {
        values.push(value);
      }
      return;
    }

    const prop = path[index];

    if (Array.isArray(value)) {
      const asInt = parseInt(prop, 10);

      if (isNaN(asInt)) {
        for (let i = 0, n = value.length; i < n; i++) {
          extract(path, index, value[i]);
        }
      } else if (asInt < value.length) {
        extract(path, index + 1, value[asInt]);
      }
    } else if (value && typeof value === 'object') {
      extract(path, index + 1, value[prop]);
    }
  };

  return (doc: SomeDoc) => {
    extract(path.split('.'), 0, doc);
    return values;
  };
};
