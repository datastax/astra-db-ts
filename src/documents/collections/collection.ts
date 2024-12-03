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

import type {
  CollectionDeleteManyResult,
  CollectionDeleteOneOptions,
  CollectionDeleteOneResult,
  CollectionFilter,
  CollectionFindOneAndDeleteOptions,
  CollectionFindOneAndReplaceOptions,
  CollectionFindOneAndUpdateOptions,
  CollectionFindOneOptions,
  CollectionFindOptions,
  CollectionInsertManyOptions,
  CollectionInsertManyResult,
  CollectionInsertOneResult,
  CollectionReplaceOneOptions,
  CollectionReplaceOneResult,
  CollectionUpdateFilter,
  CollectionUpdateManyOptions,
  CollectionUpdateManyResult,
  CollectionUpdateOneOptions,
  CollectionUpdateOneResult,
  Flatten,
  FoundDoc,
  IdOf,
  MaybeId,
  NoId,
  SomeDoc,
  ToDotNotation,
  WithId,
} from '@/src/documents/collections/types';
import { CollectionDefinition, CollectionOptions, Db } from '@/src/db';
import { BigNumberHack, DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { WithTimeout } from '@/src/lib';
import { CommandImpls } from '@/src/documents/commands/command-impls';
import { $CustomInspect } from '@/src/lib/constants';
import { CollectionInsertManyError, TooManyDocumentsToCountError } from '@/src/documents';
import JBI from 'json-bigint';
import { CollectionFindCursor } from '@/src/documents/collections/cursor';
import { withJbiNullProtoFix } from '@/src/lib/utils';
import { CollectionSerDes } from '@/src/documents/collections/ser-des';

const jbi = JBI({ storeAsString: true });

/**
 * #### Overview
 *
 * Represents the interface to a collection in a Data-API-enabled database.
 *
 * **This shouldn't be directly instantiated, but rather created via {@link Db.createCollection} or {@link Db.collection}**.
 *
 * #### Typing & Types
 *
 * Collections are inherently untyped, but you can provide your own client-side compile-time schema for type inference
 * and early-bug-catching purposes.
 *
 * A `Collection` is typed as `Collection<Schema extends SomeDoc = SomeDoc>`, where:
 * - `Schema` is the user-intended type of the documents in the collection.
 * - `SomeDoc` is set to `Record<string, any>`, representing any valid JSON object.
 *
 * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
 *
 * For example:
 * - `$date` is represented by a native JS `Date`
 * - `$uuid` is represented by a `UUID` class provided by `astra-db-ts`
 * - `$vector` is represented by a `DataAPIVector` class provided by `astra-db-ts`
 *
 * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
 *
 * @example
 * ```ts
 * interface User {
 *   _id: string,
 *   dob: Date,
 *   friends?: Record<string, UUID>, // UUID is also `astra-db-ts` provided
 *   vector: DataAPIVector,
 * }
 *
 * await db.collection<User>('users').insertOne({
 *   _id: '123',
 *   dob: new Date(),
 *   vector: new DataAPIVector([1, 2, 3]), // This can also be passed as a number[]
 * });
 * ```
 *
 * ###### Typing the `_id`
 *
 * The `_id` field of the document may be any valid JSON scalar (including {@link Date}s, {@link UUID}s, and {@link ObjectId}s)
 *
 * See {@link CollectionDefaultIdOptions} for more info on setting default `_id`s
 *
 * @example
 * ```ts
 * interface User {
 *   _id: UUID,
 *   name: string,
 * }
 *
 * const coll = await db.createCollection<User>('users', {
 *   defaultId: { type: 'uuid' },
 * });
 *
 * const resp = await coll.insertOne({ name: 'Alice' });
 * console.log(resp.insertedId.version) // 4
 * ```
 *
 * ###### Big numbers
 *
 * By default, big numbers (`bigint`s and {@link BigNumber}s from `bignumber.js`) are disabled, and will error when attempted to be serialized, and will lose precision when deserialized.
 *
 * See {@link CollectionSerDesConfig.enableBigNumbers} for more information on enabling big numbers in collections.
 *
 * ###### Custom datatypes
 *
 * You can plug in your own custom datatypes by providing some custom serialization/deserialization logic through the `serdes` option in {@link CollectionOptions}, {@link DbOptions} & {@link DataAPIClientOptions.dbOptions}.
 *
 * See {@link CollectionSerDesConfig} for much more information, but here's a quick example:
 *
 * @example
 * ```ts
 * import { $SerializeForCollections, ... } from '@datastax/astra-db-ts';
 *
 * // Custom datatype
 * class UserID {
 *   constructor(public readonly unwrap: string) {}
 *   [$SerializeForCollections] = () => this.unwrap; // Serializer checks for this symbol
 * }
 *
 * // Schema type of the collection, using the custom datatype
 * interface User {
 *   _id: UserID,
 *   name: string,
 * }
 *
 * const collection = db.collection<User>('users', {
 *   serdes: { // Serializer not necessary here since `$SerializeForCollections` is used
 *     deserialize(key, value) {
 *       if (key === '_id') return [new UserID(value)]; // [X] specifies a new value
 *     },
 *   },
 * });
 *
 * const inserted = await collection.insertOne({
 *   _id: new UserID('123'), // will be stored in db as '123'
 *   name: 'Alice',
 * });
 *
 * console.log(inserted.insertedId.unwrap); // '123'
 * ```
 *
 * ###### Disclaimer
 *
 * **Collections are inherently untyped**
 *
 * **It is on the user to ensure that the TS type of the `Collection` corresponds with the actual CQL table schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.**
 *
 * **There is no runtime type validation or enforcement of the schema.**
 *
 * @see SomeDoc
 * @see Db.createCollection
 * @see Db.collection
 * @see CollectionDefaultIdOptions
 * @see CollectionSerDesConfig
 * @see CollectionOptions
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
  public readonly name!: string;

  /**
   * The keyspace that the collection resides in.
   */
  public readonly keyspace!: string;

  /**
   * Use {@link Db.collection} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: CollectionOptions<Schema> | undefined) {
    Object.defineProperty(this, 'name', {
      value: name,
      writable: false,
    });

    Object.defineProperty(this, 'keyspace', {
      value: opts?.keyspace ?? db.keyspace,
      writable: false,
    });

    const hack: BigNumberHack = {
      parseWithBigNumbers: () => !!opts?.serdes?.enableBigNumbers,
      parser: withJbiNullProtoFix(jbi),
    };
    this.#httpClient = httpClient.forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(this.keyspace, this.name, opts, hack);
    this.#commands = new CommandImpls(this, this.#httpClient, new CollectionSerDes(opts?.serdes));
    this.#db = db;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `Collection(keyspace="${this.keyspace}",name="${this.name}")`,
    });
  }

  /**
   * ##### Overview
   *
   * Atomically inserts a single document into the collection.
   *
   * @example
   * ```ts
   * import { UUID, ObjectId, ... } from '@datastax/astra-db-ts';
   *
   * // Insert a document with a specific ID
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.insertOne({ _id: new ObjectID(), name: 'Jane Doe' });
   * await collection.insertOne({ _id: UUID.v7(), name: 'Dane Joe' });
   *
   * // Insert a document with a vector (if enabled on the collection)
   * await collection.insertOne({ _id: 1, name: 'Jane Doe', $vector: [.12, .52, .32] });
   *
   * // or if vectorize (auto-embedding-generation) is enabled
   * await collection.insertOne({ _id: 1, name: 'Jane Doe', $vectorize: "Hey there!" });
   * ```
   *
   * ##### The `_id` field
   *
   * If the document does not contain an `_id` field, the server will generate an id for the document. The type of the id may be specified in {@link CollectionDefinition.defaultId} at collection creation, otherwise it'll just be a raw UUID string. This generation does not mutate the document.
   *
   * If an `_id` is provided which corresponds to a document that already exists in the collection, a {@link DataAPIResponseError} is raised, and the insertion fails.
   *
   * If you prefer to upsert instead, see {@link Collection.replaceOne}.
   *
   * @example
   * ```typescript
   * // Insert a document with an autogenerated ID
   * await collection.insertOne({ name: 'Jane Doe' });
   *
   * // Use the inserted ID (generated or not)
   * const resp = await collection.insertOne({ name: 'Lemmy' });
   * console.log(resp.insertedId);
   *
   * // Or if the collection has a default ID
   * const collection = db.createCollection('users', {
   *   defaultId: { type: 'uuid' },
   * });
   *
   * const resp = await collection.insertOne({ name: 'Lemmy' });
   * console.log(resp.insertedId.version); // 4
   * ```
   *
   * @param document - The document to insert.
   * @param options - The options for this operation.
   *
   * @returns The ID of the inserted document.
   */
  public async insertOne(document: MaybeId<Schema>, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<CollectionInsertOneResult<Schema>> {
    return this.#commands.insertOne(document, options);
  }

  /**
   * ##### Overview
   *
   * Inserts many documents into the collection.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe' },
   *   { name: 'Jane Doe' },
   * ]);
   * ```
   *
   * ##### Chunking
   *
   * **NOTE: This function paginates the insertion of documents in chunks to avoid running into insertion limits.** This means multiple requests may be made to the server.
   *
   * This operation is **not necessarily atomic**. Depending on the amount of inserted documents, and if it's ordered or not, it can keep running (in a blocking manner) for a macroscopic amount of time. In that case, new documents that are inserted from another concurrent process/application may be inserted during the execution of this method call, and if there are duplicate keys, it's not easy to predict which application will win the race.
   *
   * By default, it inserts documents in chunks of 50 at a time. You can fine-tune the parameter through the `chunkSize` option. Note that increasing chunk size won't necessarily increase performance depending on document size. Instead, increasing concurrency may help.
   *
   * You can set the `concurrency` option to control how many network requests are made in parallel on unordered insertions. Defaults to `8`.
   *
   * @example
   * ```ts
   * const docs = Array.from({ length: 100 }, (_, i) => ({ _id: i }));
   * await collection.insertMany(docs, { batchSize: 100 });
   * ```
   *
   * ##### Ordered insertion
   *
   * You may set the `ordered` option to `true` to stop the operation after the first error; otherwise all documents may be parallelized and processed in arbitrary order, improving, perhaps vastly, performance.
   *
   * Setting the `ordered` operation disables any parallelization so insertions truly are stopped after the very first error.
   *
   * @example
   * ```ts
   * // will throw an InsertManyError after the 2nd doc is inserted with a duplicate key
   * // the 3rd doc will never attempt to be inserted
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe' },
   *   { _id: '1', name: 'John Doe' },
   *   { _id: '2', name: 'Jane Doe' },
   * ], {
   *   ordered: true,
   * });
   * ```
   *
   * ##### The `_id` field
   *
   * If any document does not contain an `_id` field, the server will generate an id for the document. The type of the id may be specified in {@link CollectionDefinition.defaultId} at creation, otherwise it'll just be a UUID string. This generation will not mutate the documents.
   *
   * If any `_id` is provided which corresponds to a document that already exists in the collection, an {@link CollectionInsertManyError} is raised, and the insertion (partially) fails.
   *
   * If you prefer to upsert instead, see {@link Collection.replaceOne}.
   *
   * @example
   * ```typescript
   * // Insert documents with autogenerated IDs
   * await collection.insertMany([
   *   { name: 'John Doe' },
   *   { name: 'Jane Doe' },
   * ]);
   *
   * // Use the inserted IDs (generated or not)
   * const resp = await collection.insertMany([
   *   { name: 'Lemmy' },
   *   { name: 'Kilmister' },
   * ]);
   * console.log(resp.insertedIds);
   *
   * // Or if the collection has a default ID
   * const collection = db.createCollection('users', {
   *   defaultId: { type: 'objectId' },
   * });
   *
   * const resp = await collection.insertMany([
   *   { name: 'Lynyrd' },
   *   { name: 'Skynyrd' },
   * ]);
   *
   * console.log(resp.insertedIds[0].getTimestamp());
   * ```
   *
   * ##### `InsertManyError`
   *
   * If any 2XX insertion error occurs, the operation will throw an {@link CollectionInsertManyError} containing the partial result.
   *
   * If a thrown exception is not due to an insertion error, e.g. a `5xx` error or network error, the operation will throw the underlying error.
   *
   * In case of an unordered request, if the error was a simple insertion error, the {@link CollectionInsertManyError} will be thrown after every document has been attempted to be inserted. If it was a `5xx` or similar, the error will be thrown immediately.
   *
   * @param documents - The documents to insert.
   * @param options - The options for this operation.
   *
   * @returns The IDs of the inserted documents (and the count)
   *
   * @throws CollectionInsertManyError - If the operation fails.
   */
  public async insertMany(documents: readonly MaybeId<Schema>[], options?: CollectionInsertManyOptions): Promise<CollectionInsertManyResult<Schema>> {
    return this.#commands.insertMany(documents, options, CollectionInsertManyError);
  }

  /**
   * ##### Overview
   *
   * Atomically updates a single document in the collection.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.updateOne({ _id: '1' }, { $set: { name: 'Jane Doe' } });
   * ```
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.updateOne(
   *   { _id: 42 },
   *   { $set: { age: 27 }, $setOnInsert: { name: 'Kasabian' } },
   *   { upsert: true },
   * );
   *
   * if (resp.upsertedCount) {
   *   console.log(resp.upsertedId); // 42
   * }
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter}` for much more information.
   *
   * Just keep in mind that if the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ##### Update operators
   *
   * The update filter can contain a variety of operators to modify the document. See {@link CollectionUpdateFilter} for more information & examples.
   *
   * ##### Update by vector search
   *
   * If the collection has vector search enabled, you can update the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * // Update by vector search
   * await collection.insertOne({ name: 'John Doe', $vector: [.12, .52, .32] });
   *
   * await collection.updateOne(
   *   { name: 'John Doe' },
   *   { $set: { name: 'Jane Doe', $vectorize: "Ooh, she's a little runaway" } },
   *   { sort: { $vector: [.09, .58, .21] } },
   * );
   * ```
   *
   * @param filter - A filter to select the document to update.
   * @param update - The update to apply to the selected document.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   *
   * @see StrictSort
   */
  public async updateOne(filter: CollectionFilter<Schema>, update: CollectionUpdateFilter<Schema>, options?: CollectionUpdateOneOptions): Promise<CollectionUpdateOneResult<Schema>> {
    return this.#commands.updateOne(filter, update, options);
  }

  /**
   * ##### Overview
   *
   * Updates many documents in the collection.
   *
   * ##### Pagination
   *
   * **NOTE: This function paginates the updating of documents in batches due to server update limits.** The limit is set on the server-side, and not changeable via the client side. This means multiple requests may be made to the server.
   *
   * This operation is **not necessarily atomic**. Depending on the amount of matching documents, it can keep running (in a blocking manner) for a macroscopic amount of time. In that case, documents that are modified/inserted from another concurrent process/application may be modified/inserted during the execution of this method call.
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * Only one document may be upserted per command.
   *
   * @example
   * ```ts
   * const resp = await collection.updateMany(
   *   { name: 'Kasabian' },
   *   { $set: { age: 27 }, $setOnInsert: { _id: 42 } },
   *   { upsert: true },
   * );
   *
   * if (resp.upsertedCount) {
   *   console.log(resp.upsertedId); // 42
   * }
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * Just keep in mind that if the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ##### Update operators
   *
   * The update filter can contain a variety of operators to modify the document. See {@link CollectionUpdateFilter} for more information & examples.
   *
   * {@link Collection.updateOne} also contains some examples of basic update filter usage.
   *
   * ##### Update by vector search
   *
   * If the collection has vector search enabled, you can update the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * // Update by vector search
   * await collection.insertOne({ name: 'John Doe', $vector: [.12, .52, .32] });
   *
   * await collection.updateMany(
   *   { name: 'John Doe' },
   *   { $set: { name: 'Jane Doe', $vectorize: "Ooh, she's a little runaway" } },
   *   { sort: { $vector: [.09, .58, .21] } },
   * );
   * ```
   *
   * @param filter - A filter to select the documents to update.
   * @param update - The update to apply to the selected documents.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   */
  public async updateMany(filter: CollectionFilter<Schema>, update: CollectionUpdateFilter<Schema>, options?: CollectionUpdateManyOptions): Promise<CollectionUpdateManyResult<Schema>> {
    return this.#commands.updateMany(filter, update, options);
  }

  /**
   * ##### Overview
   *
   * Replaces a single document in the collection.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.replaceOne({ _id: '1' }, { name: 'Dohn Joe' });
   * ```
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.replaceOne(
   *   { _id: 42 },
   *   { name: 'Jessica' },
   *   { upsert: true },
   * );
   *
   * if (resp.upsertedCount) {
   *   console.log(resp.upsertedId); // 42
   * }
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * Just keep in mind that if the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ##### Replace by vector search
   *
   * If the collection has vector search enabled, you can replace the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await collection.insertOne({ name: 'John Doe', $vector: [.12, .52, .32] });
   *
   * await collection.replaceOne(
   *   { name: 'John Doe' },
   *   { name: 'Jane Doe', $vectorize: "Ooh, she's a little runaway" },
   *   { sort: { $vector: [.09, .58, .21] } },
   * );
   * ```
   *
   * @param filter - A filter to select the document to replace.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   */
  public async replaceOne(filter: CollectionFilter<Schema>, replacement: NoId<Schema>, options?: CollectionReplaceOneOptions): Promise<CollectionReplaceOneResult<Schema>> {
    return this.#commands.replaceOne(filter, replacement, options);
  }

  /**
   * ##### Overview
   *
   * Atomically deletes a single document from the collection.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.deleteOne({ name: 'John Doe' });
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * Just keep in mind that if the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ##### Delete by vector search
   *
   * If the collection has vector search enabled, you can delete the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await collection.insertOne({ name: 'John Doe', $vector: [.12, .52, .32] });
   * await collection.deleteOne({}, { sort: { $vector: [.09, .58, .42] }});
   * ```
   *
   * @param filter - A filter to select the document to delete.
   * @param options - The options for this operation.
   *
   * @returns How many documents were deleted.
   */
  public async deleteOne(filter: CollectionFilter<Schema>, options?: CollectionDeleteOneOptions): Promise<CollectionDeleteOneResult> {
    return this.#commands.deleteOne(filter, options);
  }

  /**
   * ##### Overview
   *
   * Deletes many documents from the collection.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1 },
   *   { name: 'John Doe', age: 2 },
   * ]);
   * await collection.deleteMany({ name: 'John Doe' });
   * ```
   *
   * ##### Pagination
   *
   * **NOTE: This function paginates the deletion of documents in batches due to server deletion limits.** The limit is set on the server-side, and not changeable via the client side. This means multiple requests may be made to the server.
   *
   * This operation is **not necessarily atomic**. Depending on the amount of matching documents, it can keep running (in a blocking manner) for a macroscopic amount of time. In that case, documents that are modified/inserted from another concurrent process/application may be modified/inserted during the execution of this method call.
   *
   * ##### Filtering
   *
   * **If an empty filter is passed, all documents in the collection will atomically be deleted in a single API call. Proceed with caution.**
   *
   * The filter can contain a variety of operators & combinators to select the documents. See {@link CollectionFilter} for much more information.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe' },
   *   { name: 'Jane Doe' },
   * ]);
   *
   * const resp = await collection.deleteMany({});
   * console.log(resp.deletedCount); // -1
   * ```
   *
   * @param filter - A filter to select the documents to delete.
   * @param options - The options for this operation.
   *
   * @returns How many documents were deleted.
   */
  public async deleteMany(filter: CollectionFilter<Schema>, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<CollectionDeleteManyResult> {
    return this.#commands.deleteMany(filter, options);
  }

  /**
   * ##### Overview
   *
   * Find documents in the collection, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const cursor = await collection.find({ name: 'John Doe' });
   * const docs = await cursor.toArray();
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Collection.find} is used for when no projection is provided, and it is safe to assume the returned documents are going to be of type `Schema`.
   *
   * If it can not be inferred that a projection is definitely not provided, the `Schema` is forced to be `Partial<Schema>` if the user does not provide their own, in order to prevent type errors and ensure the user is aware that the document may not be of the same type as `Schema`.
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the documents. See {@link CollectionFilter} for much more information.
   *
   * If the filter is empty, all documents in the collection will be returned (up to any provided/implied limit).
   *
   * ##### Find by vector search
   *
   * If the collection has vector search enabled, you can find the most relevant documents by providing a vector in the sort option.
   *
   * Vector ANN searches cannot return more than a set number of documents, which, at the time of writing, is 1000 items.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', $vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
   * ]);
   *
   * const cursor = collection.find({}, {
   *   sort: { $vector: [.12, .52, .32] },
   * });
   *
   * // Returns 'John Doe'
   * console.log(await cursor.next());
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to sort the documents returned by the cursor. See {@link Sort} & {@link StrictSort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to the order of the documents returned.
   *
   * When providing a non-vector sort, the Data API will return a smaller number of documents, set to 20 at the time of writing, and stop there. The returned documents are the top results across the whole collection according to the requested criterion.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const cursor = collection.find({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // Returns 'John Doe' (age 2, height 42), 'John Doe' (age 1, height 168)
   * console.log(await cursor.toArray());
   * ```
   *
   * ##### Other options
   *
   * Other available options include `skip`, `limit`, `includeSimilarity`, and `includeSortVector`. See {@link CollectionFindOptions} and {@link FindCursor} for more information.
   *
   * If you prefer, you may also set these options using a fluent interface on the {@link FindCursor} itself.
   *
   * @example
   * ```ts
   * // cursor :: FindCursor<string>
   * const cursor = collection.find({})
   *   .sort({ $vector: [.12, .52, .32] })
   *   .projection<{ name: string, age: number }>({ name: 1, age: 1 })
   *   .includeSimilarity(true)
   *   .map(doc => `${doc.name} (${doc.age})`);
   * ```
   *
   * @remarks
   * When not specifying sorting criteria at all (by vector or otherwise),
   * the cursor can scroll through an arbitrary number of documents as
   * the Data API and the client periodically exchange new chunks of documents.
   *
   * --
   *
   * It should be noted that the behavior of the cursor in the case documents
   * have been added/removed after the `find` was started depends on database
   * internals, and it is not guaranteed, nor excluded, that such "real-time"
   * changes in the data would be picked up by the cursor.
   *
   * @param filter - A filter to select the documents to find. If not provided, all documents will be returned.
   * @param options - The options for this operation.
   *
   * @returns A {@link FindCursor} which can be iterated over.
   */
  public find(filter: CollectionFilter<Schema>, options?: CollectionFindOptions & { projection?: never }): CollectionFindCursor<FoundDoc<Schema>, FoundDoc<Schema>>

  /**
   * ##### Overview
   *
   * Find documents in the collection, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const cursor = await collection.find({ name: 'John Doe' });
   * const docs = await cursor.toArray();
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Collection.find} is used for when a projection is provided (or at the very least, it can not be inferred that a projection is NOT provided).
   *
   * In this case, the user must provide an explicit projection type, or the type of the documents will be `Partial<Schema>`, to prevent type-mismatches when the schema is strictly provided.
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   car: { make: string, model: string },
   * }
   *
   * const collection = db.collection<User>('users');
   *
   * // Defaulting to `Partial<User>` when projection is not provided
   * const cursor = await collection.find({}, {
   *   projection: { car: 1 },
   * });
   *
   * // next :: { car?: { make?: string, model?: string } }
   * const next = await cursor.next();
   * console.log(next.car?.make);
   *
   * // Explicitly providing the projection type
   * const cursor = await collection.find<Pick<User, 'car'>>({}, {
   *   projection: { car: 1 },
   * });
   *
   * // next :: { car: { make: string, model: string } }
   * const next = await cursor.next();
   * console.log(next.car.make);
   *
   * // Projection existence can not be inferred
   * function mkFind(projection?: Projection) {
   *   return collection.find({}, { projection });
   * }
   *
   * // next :: Partial<User>
   * const next = await mkFind({ car: 1 }).next();
   * console.log(next.car?.make);
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the documents. See {@link CollectionFilter} for much more information.
   *
   * If the filter is empty, all documents in the collection will be returned (up to any provided/implied limit).
   *
   * ##### Find by vector search
   *
   * If the collection has vector search enabled, you can find the most relevant documents by providing a vector in the sort option.
   *
   * Vector ANN searches cannot return more than a set number of documents, which, at the time of writing, is 1000 items.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', $vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
   * ]);
   *
   * const cursor = collection.find({}, {
   *   sort: { $vector: [.12, .52, .32] },
   * });
   *
   * // Returns 'John Doe'
   * console.log(await cursor.next());
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to sort the documents returned by the cursor. See {@link Sort} & {@link StrictSort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to the order of the documents returned.
   *
   * When providing a non-vector sort, the Data API will return a smaller number of documents, set to 20 at the time of writing, and stop there. The returned documents are the top results across the whole collection according to the requested criterion.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const cursor = collection.find({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // Returns 'John Doe' (age 2, height 42), 'John Doe' (age 1, height 168)
   * console.log(await cursor.toArray());
   * ```
   *
   * ##### Other options
   *
   * Other available options include `skip`, `limit`, `includeSimilarity`, and `includeSortVector`. See {@link CollectionFindOptions} and {@link FindCursor} for more information.
   *
   * If you prefer, you may also set these options using a fluent interface on the {@link FindCursor} itself.
   *
   * @example
   * ```ts
   * // cursor :: FindCursor<string>
   * const cursor = collection.find({})
   *   .sort({ $vector: [.12, .52, .32] })
   *   .projection<{ name: string, age: number }>({ name: 1, age: 1 })
   *   .includeSimilarity(true)
   *   .map(doc => `${doc.name} (${doc.age})`);
   * ```
   *
   * @remarks
   * When not specifying sorting criteria at all (by vector or otherwise),
   * the cursor can scroll through an arbitrary number of documents as
   * the Data API and the client periodically exchange new chunks of documents.
   *
   * --
   *
   * It should be noted that the behavior of the cursor in the case documents
   * have been added/removed after the `find` was started depends on database
   * internals, and it is not guaranteed, nor excluded, that such "real-time"
   * changes in the data would be picked up by the cursor.
   *
   * @param filter - A filter to select the documents to find. If not provided, all documents will be returned.
   * @param options - The options for this operation.
   *
   * @returns A {@link FindCursor} which can be iterated over.
   */
  public find<TRaw extends SomeDoc = Partial<Schema>>(filter: CollectionFilter<Schema>, options: CollectionFindOptions): CollectionFindCursor<FoundDoc<TRaw>, FoundDoc<TRaw>>

  public find(filter: CollectionFilter<Schema>, options?: CollectionFindOptions): CollectionFindCursor<SomeDoc, any> {
    return this.#commands.find(filter, options, CollectionFindCursor);
  }

  /**
   * ##### Overview
   *
   * Find a single document in the collection, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const doc = await collection.findOne({ name: 'John Doe' });
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Collection.findOne} is used for when no projection is provided, and it is safe to assume the returned document is going to be of type `Schema`.
   *
   * If it can not be inferred that a projection is definitely not provided, the `Schema` is forced to be `Partial<Schema>` if the user does not provide their own, in order to prevent type errors and ensure the user is aware that the document may not be of the same type as `Schema`.
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ##### Find by vector search
   *
   * If the collection has vector search enabled, you can find the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', $vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
   * ]);
   *
   * const doc = collection.findOne({}, {
   *   sort: { $vector: [.12, .52, .32] },
   * });
   *
   * // 'John Doe'
   * console.log(doc.name);
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to pick the most relevant document. See {@link Sort} & {@link StrictSort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to which of the documents which matches the filter is returned.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const doc = collection.findOne({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // 'John Doe' (age 2, height 42)
   * console.log(doc.name);
   * ```
   *
   * ##### Other options
   *
   * Other available options include `includeSimilarity`. See {@link CollectionFindOneOptions} for more information.
   *
   * If you want to get `skip` or `includeSortVector` as well, use {@link Collection.find} with a `limit: 1` instead.
   *
   * @example
   * ```ts
   * const doc = await cursor.findOne({}, {
   *   sort: { $vector: [.12, .52, .32] },
   *   includeSimilarity: true,
   * });
   * ```
   *
   * @param filter - A filter to select the documents to find. If not provided, all documents will be returned.
   * @param options - The options for this operation.
   *
   * @returns A document matching the criterion, or `null` if no such document exists.
   */
  public async findOne(filter: CollectionFilter<Schema>, options?: CollectionFindOneOptions & { projection?: never }): Promise<FoundDoc<Schema> | null>

  /**
   * ##### Overview
   *
   * Find a single document in the collection, optionally matching the provided filter.
   *
   * @example
   * ```ts
   * const doc = await collection.findOne({ name: 'John Doe' });
   * ```
   *
   * ##### Projection
   *
   * This overload of {@link Collection.findOne} is used for when a projection is provided (or at the very least, it can not be inferred that a projection is NOT provided).
   *
   * In this case, the user must provide an explicit projection type, or the type of the returned document will be as `Partial<Schema>`, to prevent type-mismatches when the schema is strictly provided.
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   car: { make: string, model: string },
   * }
   *
   * const collection = db.collection<User>('users');
   *
   * // Defaulting to `Partial<User>` when projection is not provided
   * const doc = await collection.findOne({}, {
   *   projection: { car: 1 },
   * });
   *
   * // doc :: { car?: { make?: string, model?: string } }
   * console.log(doc.car?.make);
   *
   * // Explicitly providing the projection type
   * const doc = await collection.findOne<Pick<User, 'car'>>({}, {
   *   projection: { car: 1 },
   * });
   *
   * // doc :: { car: { make: string, model: string } }
   * console.log(doc.car.make);
   *
   * // Projection existence can not be inferred
   * function findOne(projection?: Projection) {
   *   return collection.findOne({}, { projection });
   * }
   *
   * // doc :: Partial<User>
   * const doc = await findOne({ car: 1 }).next();
   * console.log(doc.car?.make);
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ##### Find by vector search
   *
   * If the collection has vector search enabled, you can find the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', $vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
   * ]);
   *
   * const doc = collection.findOne({}, {
   *   sort: { $vector: [.12, .52, .32] },
   * });
   *
   * // 'John Doe'
   * console.log(doc.name);
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to pick the most relevant document. See {@link Sort} & {@link StrictSort} for more information.
   *
   * The [DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/index.html) also contains further information on the available sort operators.
   *
   * If the sort option is not provided, there is no guarantee as to which of the documents which matches the filter is returned.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const doc = collection.findOne({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // 'John Doe' (age 2, height 42)
   * console.log(doc.name);
   * ```
   *
   * ##### Other options
   *
   * Other available options include `includeSimilarity`. See {@link CollectionFindOneOptions} for more information.
   *
   * If you want to get `skip` or `includeSortVector` as well, use {@link Collection.find} with a `limit: 1` instead.
   *
   * @example
   * ```ts
   * const doc = await cursor.findOne({}, {
   *   sort: { $vector: [.12, .52, .32] },
   *   includeSimilarity: true,
   * });
   * ```
   *
   * @param filter - A filter to select the documents to find. If not provided, all documents will be returned.
   * @param options - The options for this operation.
   *
   * @returns A document matching the criterion, or `null` if no such document exists.
   */
  public async findOne<TRaw extends SomeDoc = Partial<Schema>>(filter: CollectionFilter<Schema>, options: CollectionFindOneOptions): Promise<FoundDoc<TRaw> | null>

  public async findOne(filter: CollectionFilter<Schema>, options?: CollectionFindOneOptions): Promise<SomeDoc | null> {
    return this.#commands.findOne(filter, options);
  }

  /**
   * ##### Overview
   *
   * Return a list of the unique values of `key` across the documents in the collection that match the provided filter.
   *
   * @example
   * ```ts
   * const docs = await collection.distinct('name');
   * ```
   *
   * ##### Major disclaimer
   *
   * **NOTE: This is a *client-side* operation**—this effectively browses all matching documents (albeit with a
   * projection) using the logic of the {@link Collection.find} method, and collects the unique value for the
   * given `key` manually. As such, there may be performance, latency and ultimately billing implications if the
   * amount of matching documents is large.
   *
   * ##### Usage
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
   * @param options - The options for this operation.
   *
   * @returns A list of all the unique values selected by the given `key`
   */
  public async distinct<Key extends string>(key: Key, filter: CollectionFilter<Schema>, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<Flatten<(SomeDoc & ToDotNotation<FoundDoc<Schema>>)[Key]>[]> {
    return this.#commands.distinct(key, filter, options, CollectionFindCursor);
  }

  /**
   * ##### Overview
   *
   * Counts the number of documents in the collection, optionally with a filter.
   *
   * @example
   * ```ts
   * const count = await collection.countDocuments({ name: 'John Doe' }, 1000);
   * ```
   *
   * ##### The `limit` parameter
   *
   * Takes in a `limit` option which dictates the maximum number of documents that may be present before a
   * {@link TooManyDocumentsToCountError} is thrown. If the limit is higher than the highest limit accepted by the
   * Data API, a {@link TooManyDocumentsToCountError} will be thrown anyway (i.e. `1000`).
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { name: 'John Doe' },
   *   { name: 'Jane Doe' },
   * ]);
   *
   * const count = await collection.countDocuments({}, 1000);
   * console.log(count); // 1
   *
   * // Will throw a TooManyDocumentsToCountError as it counts 2, but the limit is 1
   * const count = await collection.countDocuments({}, 1);
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
   */
  public async countDocuments(filter: CollectionFilter<Schema>, upperBound: number, options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<number> {
    return this.#commands.countDocuments(filter, upperBound, options, TooManyDocumentsToCountError);
  }

  /**
   * ##### Overview
   *
   * Gets an estimate of the count of documents in a collection.
   *
   * This gives a very rough estimate of the number of documents in the collection. It is not guaranteed to be
   * accurate, and should not be used as a source of truth for the number of documents in the collection.
   *
   * But this operation is faster than {@link Collection.countDocuments}, and while it doesn't
   * accept a filter, **it can handle more than 1000 documents.**
   *
   * @example
   * ```ts
   * const count = await collection.estimatedDocumentCount();
   * console.log(count); // Hard to predict exact number
   * ```
   *
   * @param options - The options for this operation.
   *
   * @returns The estimated number of documents in the collection
   */
  public async estimatedDocumentCount(options?: WithTimeout<'generalMethodTimeoutMs'>): Promise<number> {
    return this.#commands.estimatedDocumentCount(options);
  }

  /**
   * ##### Overview
   *
   * Atomically finds a single document in the collection and replaces it.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.findOneAndReplace({ _id: '1' }, { name: 'Dohn Joe' });
   * ```
   *
   * ##### Projection
   *
   * You can set `projection` to determine which fields to include in the returned document.
   *
   * For type-safety reasons, this function allows you to pass in your own projection type, or defaults to `WithId<Schema>` if not provided.
   *
   * If you use a projection and do not pass in the appropriate type, you may very well run into runtime type errors not caught by the compiler.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe', age: 3 });
   *
   * const doc = await collection.findOneAndReplace<{ name: string }>(
   *   { _id: '1' },
   *   { name: 'Dohn Joe' },
   *   { projection: { name: 1, _id: 0 } },
   * );
   *
   * // Prints { name: 'Dohn Joe' }
   * console.log(doc);
   * ```
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.findOneAndReplace(
   *   { _id: 42 },
   *   { name: 'Jessica' },
   *   { upsert: true },
   * );
   *
   * console.log(resp); // null, b/c no previous document was found
   * ```
   *
   * ##### `returnDocument`
   *
   * `returnDocument` (default `'before'`) controls whether the original or the updated document is returned.
   * - `'before'`: Returns the document as it was before the update, or `null` if the document was upserted.
   * - `'after'`: Returns the document as it is after the update.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   *
   * const after = await collection.findOneAndReplace(
   *   { _id: '1' },
   *   { name: 'Jane Doe' },
   *   { returnDocument: 'after' },
   * );
   *
   * // Prints { _id: '1', name: 'Jane Doe' }
   * console.log(after);
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link Filter} for much more information.
   *
   * Just keep in mind that if the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * @param filter - A filter to select the document to find.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for this operation.
   *
   * @returns The document before/after replacement, depending on the type of `returnDocument`
   */
  public async findOneAndReplace<TRaw extends SomeDoc = WithId<Schema>>(filter: CollectionFilter<Schema>, replacement: NoId<Schema>, options?: CollectionFindOneAndReplaceOptions): Promise<TRaw | null> {
    return this.#commands.findOneAndReplace(filter, replacement, options);
  }

  /**
   * ##### Overview
   *
   * Atomically finds a single document in the collection and deletes it.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.findOneAndDelete({ _id: '1' });
   * ```
   *
   * ##### Projection
   *
   * You can set `projection` to determine which fields to include in the returned document.
   *
   * For type-safety reasons, this function allows you to pass in your own projection type, or defaults to `WithId<Schema>` if not provided.
   *
   * If you use a projection and do not pass in the appropriate type, you may very well run into runtime type errors not caught by the compiler.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe', age: 3 });
   *
   * const doc = await collection.findOneAndDelete<{ name: string }>(
   *   { _id: '1' },
   *   { projection: { name: 1, _id: 0 } },
   * );
   *
   * // Prints { name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * Just keep in mind that if the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * @param filter - A filter to select the document to find.
   * @param options - The options for this operation.
   *
   * @returns The deleted document, or `null` if no document was found.
   */
  public async findOneAndDelete<TRaw extends SomeDoc = WithId<Schema>>(filter: CollectionFilter<Schema>, options?: CollectionFindOneAndDeleteOptions): Promise<TRaw | null> {
    return this.#commands.findOneAndDelete(filter, options);
  }

  /**
   * ##### Overview
   *
   * Atomically finds a single document in the collection and updates it.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.findOneAndUpdate({ _id: '1' }, { $set: { name: 'Jane Doe' } });
   * ```
   *
   * ##### Projection
   *
   * You can set `projection` to determine which fields to include in the returned document.
   *
   * For type-safety reasons, this function allows you to pass in your own projection type, or defaults to `WithId<Schema>` if not provided.
   *
   * If you use a projection and do not pass in the appropriate type, you may very well run into runtime type errors not caught by the compiler.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe', age: 3 });
   *
   * const doc = await collection.findOneAndUpdate<{ name: string }>(
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' } },
   *   { projection: { name: 1, _id: 0 } },
   * );
   *
   * // Prints { name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.findOneAndUpdate(
   *   { _id: 42 },
   *   { $set: { name: 'Jessica' } },
   *   { upsert: true },
   * );
   *
   * console.log(resp); // null, b/c no previous document was found
   * ```
   *
   * ##### `returnDocument`
   *
   * `returnDocument` (default `'before'`) controls whether the original or the updated document is returned.
   * - `'before'`: Returns the document as it was before the update, or `null` if the document was upserted.
   * - `'after'`: Returns the document as it is after the update.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   *
   * const after = await collection.findOneAndUpdate(
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' } },
   *   { returnDocument: 'after' },
   * );
   *
   * // Prints { _id: '1', name: 'Jane Doe' }
   * console.log(after);
   * ```
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * Just keep in mind that if the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * @param filter - A filter to select the document to find.
   * @param update - The update to apply to the selected document.
   * @param options - The options for this operation.
   *
   * @returns The document before/after the update, depending on the type of `returnDocument`
   */
  public async findOneAndUpdate(filter: CollectionFilter<Schema>, update: CollectionUpdateFilter<Schema>, options?: CollectionFindOneAndUpdateOptions): Promise<WithId<Schema> | null> {
    return this.#commands.findOneAndUpdate(filter, update, options);
  }

  /**
   * ##### Overview
   *
   * Get the collection options, i.e. its configuration as read from the database.
   *
   * The method issues a request to the Data API each time it is invoked, without caching mechanisms;
   * this ensures up-to-date information for usages such as real-time collection validation by the application.
   *
   * @example
   * ```ts
   * const options = await collection.info();
   * console.log(options.vector);
   * ```
   *
   * @param options - The options for this operation.
   *
   * @returns The options that the collection was created with (i.e. the `vector` and `indexing` operations).
   */
  public async options(options?: WithTimeout<'collectionAdminTimeoutMs'>): Promise<CollectionDefinition<SomeDoc>> {
    const resp = await this.#db.listCollections({ timeout: options?.timeout, keyspace: this.keyspace });

    const collection = resp.find((c) => c.name === this.name);

    if (!collection) {
      throw new Error(`Can not get options for collection '${this.keyspace}.${this.name}'; collection not found. Did you use the right keyspace?`);
    }

    return collection.definition;
  }

  /**
   * ##### Overview
   *
   * Drops the collection from the database, including all the documents it contains.
   *
   * @example
   * ```typescript
   * const collection = await db.collection('my_collection');
   * await collection.drop();
   * ```
   *
   * ##### Disclaimer
   *
   * Once the collection is dropped, this object is still technically "usable", but any further operations on it
   * will fail at the Data API level; thus, it's the user's responsibility to make sure that the collection object
   * is no longer used.
   *
   * @param options - The options for this operation.
   *
   * @returns A promise which resolves when the collection has been dropped.
   *
   * @remarks Use with caution. Wear your safety goggles. Don't say I didn't warn you.
   */
  public async drop(options?: WithTimeout<'collectionAdminTimeoutMs'>): Promise<void> {
    await this.#db.dropCollection(this.name, { keyspace: this.keyspace, ...options });
  }

  /**
   * Backdoor to the HTTP client for if it's absolutely necessary. Which it almost never (if even ever) is.
   */
  public get _httpClient() {
    return this.#httpClient;
  }
}
