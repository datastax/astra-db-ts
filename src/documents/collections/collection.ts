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

import type { FindCursor } from '@/src/documents/cursor';
import type {
  CollectionDeleteManyResult,
  CollectionDeleteOneOptions,
  CollectionDeleteOneResult,
  CollectionFindOneAndDeleteOptions,
  CollectionFindOneAndReplaceOptions,
  CollectionFindOneAndUpdateOptions,
  CollectionFindOneOptions,
  CollectionFindOptions,
  CollectionInsertManyOptions,
  CollectionInsertManyResult,
  CollectionInsertOneResult,
  CollectionModifyResult,
  CollectionReplaceOneOptions,
  CollectionReplaceOneResult,
  CollectionUpdateManyOptions,
  CollectionUpdateManyResult,
  CollectionUpdateOneOptions,
  CollectionUpdateOneResult,
  Filter,
  Flatten,
  FoundDoc,
  IdOf,
  MaybeId,
  NoId,
  SomeDoc,
  ToDotNotation,
  UpdateFilter,
  WithId,
} from '@/src/documents/collections/types';
import { CollectionNotFoundError } from '@/src/db/errors';
import { CollectionOptions, CollectionSpawnOptions, Db } from '@/src/db';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { WithTimeout } from '@/src/lib';
import { constantly } from '@/src/lib/utils';
import { CommandImpls } from '@/src/documents/commands/command-impls';
import { mkCollectionSerDes } from '@/src/documents/collections/ser-des';

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
 * @see Db.createCollection
 * @see Db.collection
 *
 * @public
 */
export class Collection<Schema extends SomeDoc = SomeDoc> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #commands: CommandImpls<IdOf<Schema>>;
  readonly #db: Db;

  /**
   * The name of the collection. Unique per keyspace.
   */
  public readonly collectionName!: string;

  /**
   * The keyspace that the collection resides in.
   */
  public readonly keyspace!: string;

  /**
   * Use {@link Db.collection} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: CollectionSpawnOptions<Schema> | undefined) {
    Object.defineProperty(this, 'collectionName', {
      value: name,
      writable: false,
    });

    Object.defineProperty(this, 'keyspace', {
      value: opts?.keyspace ?? db.keyspace,
      writable: false,
    });

    this.#httpClient = httpClient.forCollection(this.keyspace, this.collectionName, opts);
    this.#commands = new CommandImpls(this.#httpClient, mkCollectionSerDes(opts?.serdes));
    this.#db = db;
  }

  /**
   * Inserts a single document into the collection.
   *
   * If the document does not contain an `_id` field, the server will generate an id for the document. The type of the
   * id may be specified in {@link CollectionOptions.defaultId} at collection creation, otherwise it'll just be a raw
   * UUID string. This generation does not mutate the document.
   *
   * If an `_id` is provided which corresponds to a document that already exists in the collection, an error is raised,
   * and the insertion fails.
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
   * // Insert a document with a vector (if enabled on the collection)
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
  public async insertOne(document: MaybeId<Schema>, options?: WithTimeout): Promise<CollectionInsertOneResult<Schema>> {
    return this.#commands.insertOne(document, options, constantly);
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
   * See {@link CollectionInsertManyOptions} for complete information about the options available for this operation.
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
  public async insertMany(documents: MaybeId<Schema>[], options?: CollectionInsertManyOptions): Promise<CollectionInsertManyResult<Schema>> {
    return this.#commands.insertMany(documents, options, constantly);
  }

  /**
   * Atomically updates a single document in the collection.
   *
   * If `upsert` is set to true, it will insert the document if no match is found.
   *
   * You can also specify a sort option to determine which document to update if multiple documents match the filter.
   *
   * See {@link CollectionUpdateOneOptions} for complete information about the options available for this operation.
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
   *   { $set: { name: 'Jane Doe', $vectorize: "Ooh, she's a little runaway" } },
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
  public async updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: CollectionUpdateOneOptions): Promise<CollectionUpdateOneResult<Schema>> {
    return this.#commands.updateOne(filter, update, options);
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
   * See {@link CollectionUpdateManyOptions} for complete information about the options available for this operation.
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
  public async updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: CollectionUpdateManyOptions): Promise<CollectionUpdateManyResult<Schema>> {
    return this.#commands.updateMany(filter, update, options);
  }

  /**
   * Replaces a single document in the collection.
   *
   * If `upsert` is set to true, it will insert the replacement regardless of if no match is found.
   *
   * See {@link CollectionReplaceOneOptions} for complete information about the options available for this operation.
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
  public async replaceOne(filter: Filter<Schema>, replacement: NoId<Schema>, options?: CollectionReplaceOneOptions): Promise<CollectionReplaceOneResult<Schema>> {
    return this.#commands.replaceOne(filter, replacement, options);
  }

  /**
   * Atomically deletes a single document from the collection.
   *
   * You can specify a `sort` option to determine which document to delete if multiple documents match the filter.
   *
   * See {@link CollectionDeleteOneOptions} for complete information about the options available for this operation.
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
  public async deleteOne(filter: Filter<Schema>, options?: CollectionDeleteOneOptions): Promise<CollectionDeleteOneResult> {
    return this.#commands.deleteOne(filter, options);
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
  public async deleteMany(filter: Filter<Schema>, options?: WithTimeout): Promise<CollectionDeleteManyResult> {
    return this.#commands.deleteMany(filter, options);
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
   * See {@link CollectionFindOptions} and {@link FindCursor} for complete information about the options available for this operation.
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
  public find(filter: Filter<Schema>, options?: CollectionFindOptions): FindCursor<FoundDoc<Schema>, FoundDoc<Schema>> {
    return this.#commands.find(this.keyspace, filter, options);
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
   * See {@link CollectionFindOneOptions} for complete information about the options available for this operation.
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
  public async findOne(filter: Filter<Schema>, options?: CollectionFindOneOptions): Promise<FoundDoc<Schema> | null> {
    return this.#commands.findOne(filter, options);
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
    return this.#commands.distinct(this.keyspace, key, filter);
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
    return this.#commands.countDocuments(filter, upperBound, options);
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
    return this.#commands.estimatedDocumentCount(options);
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
   * See {@link CollectionFindOneAndReplaceOptions} for complete information about the options available for this operation.
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
    options: CollectionFindOneAndReplaceOptions & { includeResultMetadata: true },
  ): Promise<CollectionModifyResult<Schema>>

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
   * See {@link CollectionFindOneAndReplaceOptions} for complete information about the options available for this operation.
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
    options?: CollectionFindOneAndReplaceOptions & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  public async findOneAndReplace(filter: Filter<Schema>, replacement: NoId<Schema>, options?: CollectionFindOneAndReplaceOptions): Promise<CollectionModifyResult<Schema> | WithId<Schema> | null> {
    return this.#commands.findOneAndReplace(filter, replacement, options);
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
   * See {@link CollectionFindOneAndDeleteOptions} for complete information about the options available for this operation.
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
    options: CollectionFindOneAndDeleteOptions & { includeResultMetadata: true },
  ): Promise<CollectionModifyResult<Schema>>

  /**
   * Atomically finds a single document in the collection and deletes it.
   *
   * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
   *
   * You can also set `projection` to determine which fields to include in the returned document.
   *
   * If you want the ok status along with the document, set `includeResultMetadata` to `true`.
   *
   * See {@link CollectionFindOneAndDeleteOptions} for complete information about the options available for this operation.
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
    options?: CollectionFindOneAndDeleteOptions & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  public async findOneAndDelete(filter: Filter<Schema>, options?: CollectionFindOneAndDeleteOptions): Promise<CollectionModifyResult<Schema> | WithId<Schema> | null> {
    return this.#commands.findOneAndDelete(filter, options);
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
   * See {@link CollectionFindOneAndUpdateOptions} for complete information about the options available for this operation.
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
    options: CollectionFindOneAndUpdateOptions & { includeResultMetadata: true },
  ): Promise<CollectionModifyResult<Schema>>

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
   * See {@link CollectionFindOneAndUpdateOptions} for complete information about the options available for this operation.
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
    options?: CollectionFindOneAndUpdateOptions & { includeResultMetadata?: false },
  ): Promise<WithId<Schema> | null>

  public async findOneAndUpdate(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: CollectionFindOneAndUpdateOptions): Promise<CollectionModifyResult<Schema> | WithId<Schema> | null> {
    return this.#commands.findOneAndUpdate(filter, update, options);
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

  public get _httpClient() {
    return this.#httpClient;
  }
}
