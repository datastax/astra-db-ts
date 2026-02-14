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
  CollectionCountDocumentsOptions,
  CollectionDeleteManyOptions,
  CollectionDeleteManyResult,
  CollectionDeleteOneOptions,
  CollectionDeleteOneResult,
  CollectionDistinctOptions,
  CollectionEstimatedDocumentCountOptions,
  CollectionFilter,
  CollectionFindAndRerankOptions,
  CollectionFindOneAndDeleteOptions,
  CollectionFindOneAndReplaceOptions,
  CollectionFindOneAndUpdateOptions,
  CollectionFindOneOptions,
  CollectionFindOptions,
  CollectionInsertManyOptions,
  CollectionInsertManyResult,
  CollectionInsertOneOptions,
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
  WithId,
} from '@/src/documents/collections/types/index.js';
import type {
  CollectionDefinition,
  CollectionOptions,
  Db,
  DropCollectionOptions,
  WithKeyspace,
} from '@/src/db/index.js';
import type { BigNumberHack, DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client.js';
import { HierarchicalLogger } from '@/src/lib/logging/hierarchical-logger.js';
import type { OpaqueHttpClient, CommandOptions } from '@/src/lib/index.js';
import { CommandImpls } from '@/src/documents/commands/command-impls.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import type { CommandEventMap, RerankedResult, ToDotNotation, WithSim } from '@/src/documents/index.js';
import {
  CollectionDeleteManyError,
  CollectionFindCursor,
  CollectionInsertManyError,
  CollectionUpdateManyError,
  TooManyDocumentsToCountError,
} from '@/src/documents/index.js';
import JBI from 'json-bigint';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import { withJbiNullProtoFix } from '@/src/lib/api/ser-des/utils.js';
import { CollectionFindAndRerankCursor } from '@/src/documents/collections/cursors/rerank-cursor.js';
import { InternalLogger } from '@/src/lib/logging/internal-logger.js';
import type { ParsedRootClientOpts } from '@/src/client/opts-handlers/root-opts-handler.js';

const jbi = JBI;

/**
 * ##### Overview
 *
 * Represents the interface to a collection in a Data-API-enabled database.
 *
 * > **⚠️Warning:** This isn't directly instantiated, but spawned via {@link Db.createCollection} or {@link Db.collection}.
 *
 * @example
 * ```ts
 * const collection = db.collection<Type?>('my_collection');
 * ```
 *
 * ---
 *
 * ##### Typing the collection
 *
 * Collections are inherently untyped, but you can provide your own client-side compile-time schema for type inference and early-bug-catching purposes.
 *
 * > **🚨Important:** For most intents & purposes, you can ignore the (generally negligible) difference between _WSchema_ and _RSchema_, and treat {@link Collection} as if it were typed as `Collection<Schema>`.
 *
 * A `Collection` is typed as `Collection<WSchema, RSchema>`, where:
 * - `WSchema` is the type of the row as it's written to the table (the "write" schema)
 *    - This includes inserts, filters, sorts, etc.
 *  - `RSchema` is the type of the row as it's read from the table (the "read" schema)
 *    - This includes finds
 *    - Unless custom ser/des is used, it is nearly exactly the same as `WSchema`
 *    - This defaults to `FoundDoc<WSchema>` (see {@link FoundDoc})
 *
 * ---
 *
 * ##### Typing the `_id`
 *
 * The `_id` field of the document may be any valid JSON scalar (including {@link Date}, {@link UUID}, and {@link ObjectId}).
 * - See {@link SomeId} for the enumeration of all valid types.
 * - See {@link CollectionDefaultIdOptions} for more info on setting default `_id`s.
 *
 * The type of the `_id` field is extracted from the collection schema via the {@link IdOf} utility type.
 *
 * > **💡Tip:** See {@link SomeId} for much more information on the `_id` field.
 *
 * @example
 * ```ts
 * interface User {
 *   _id: UUID,
 *   name: string,
 * }
 *
 * const coll = await db.createCollection<User>('users', {
 *   defaultId: { type: 'uuid' },
 * });
 *
 * const resp = await coll.insertOne({ name: 'Alice' });
 * console.log(resp.insertedId.version) // 4
 * ```
 *
 * ---
 *
 * ##### Datatypes
 *
 * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
 *
 * For example:
 * - `$date` is represented by a native JS {@link Date}
 * - `$uuid` is represented by an `astra-db-ts` provided {@link UUID}
 * - `$vector` is represented by an `astra-db-ts` provided {@link DataAPIVector}
 *
 * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
 *
 * @example
 * ```ts
 * interface User {
 *   _id: string,
 *   dob: Date,
 *   friends?: Record<string, UUID>, // UUID is also `astra-db-ts` provided
 *   $vector: DataAPIVector,
 * }
 *
 * await db.collection<User>('users').insertOne({
 *   _id: '123',
 *   dob: new Date(),
 *   $vector: new DataAPIVector([1, 2, 3]), // This can also be passed as a number[]
 * });
 * ```
 *
 * The full list of relevant datatypes (for collections) includes: {@link UUID}, {@link ObjectId}, {@link Date}, {@link DataAPIVector} and {@link BigNumber}.
 *
 * ---
 *
 * ##### Big numbers
 *
 * By default, big numbers (`bigint`s and {@link BigNumber}s from `bignumber.js`) are disabled, and will error when attempted to be serialized, and will lose precision when deserialized.
 *
 * See {@link CollectionSerDesConfig.enableBigNumbers} for more information on enabling big numbers in collections.
 *
 * ---
 *
 * ##### Custom datatypes
 *
 * You can plug in your own custom datatypes, as well as enable many other features by providing some custom serialization/deserialization logic through the `serdes` option in {@link CollectionOptions}, {@link DbOptions}, and/or {@link DataAPIClientOptions.dbOptions}.
 *
 * Note however that this is currently not entirely stable, and should be used with caution.
 *
 * ---
 *
 * ##### 🚨Disclaimers
 *
 * *Collections are inherently untyped. There is no runtime type validation or enforcement of the schema.*
 *
 * *It is on the user to ensure that the TS type of the `Collection` corresponds with the actual intended collection schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviors and easily-preventable errors.*
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
export class Collection<WSchema extends SomeDoc = SomeDoc, RSchema extends WithId<SomeDoc> = FoundDoc<WSchema>> extends HierarchicalLogger<CommandEventMap> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #commands: CommandImpls<IdOf<RSchema>>;
  readonly #db: Db;

  /**
   * ##### Overview
   *
   * The user-provided, case-sensitive. name of the collection
   *
   * This is unique among all tables and collections in its keyspace, but not necessarily unique across the entire database.
   *
   * It is up to the user to ensure that this collection really exists.
   */
  public readonly name!: string;

  /**
   * ##### Overview
   *
   * The keyspace where the collection resides in.
   *
   * It is up to the user to ensure that this keyspace really exists, and that this collection is in it.
   */
  public readonly keyspace!: string;

  /**
   * Use {@link Db.collection} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, rootOpts: ParsedRootClientOpts, opts: CollectionOptions | undefined) {
    const loggingConfig = InternalLogger.cfg.concatParseWithin([rootOpts.dbOptions.logging], opts, 'logging');
    super(db, loggingConfig);

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

    this.#httpClient = httpClient.forTableSlashCollectionOrWhateverWeWouldCallTheUnionOfTheseTypes(this, opts, hack);
    this.#commands = new CommandImpls(this, this.#httpClient, new CollSerDes(CollSerDes.cfg.parse(opts?.serdes)));
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
   * See {@link CollectionInsertOneOptions} and {@link CollectionInsertOneResult} as well for more information.
   *
   * @example
   * ```ts
   * import { UUID, ObjectId, ... } from '@datastax/astra-db-ts';
   *
   * // Insert a document with a specific ID
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.insertOne({ _id: new ObjectId(), name: 'Jane Doe' });
   * await collection.insertOne({ _id: UUID.v7(), name: 'Dane Joe' });
   *
   * // Insert a document with a vector (if enabled on the collection)
   * await collection.insertOne({ _id: 1, name: 'Jane Doe', $vector: [.12, .52, .32] });
   *
   * // or if vectorize (auto-embedding-generation) is enabled
   * await collection.insertOne({ _id: 1, name: 'Jane Doe', $vectorize: "Hey there!" });
   * ```
   *
   * ---
   *
   * ##### The `_id` field
   *
   * If the document does not contain an `_id` field, the server will **generate an _id** for the document.
   * - The type of the generated id may be specified in {@link CollectionDefinition.defaultId} at collection creation, otherwise it'll just be a raw UUID string.
   * - This generation does not mutate the document.
   *
   * If an `_id` is provided which corresponds to a document that already exists in the collection, a {@link DataAPIResponseError} is raised, and the insertion fails.
   *
   * If you prefer to upsert a document instead, see {@link Collection.replaceOne}.
   *
   * > **💡Tip:** See {@link SomeId} for much more information on the `_id` field.
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
   *   defaultId: { type: 'uuid' },
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
   *
   * @see CollectionInsertOneOptions
   * @see CollectionInsertOneResult
   */
  public async insertOne(document: MaybeId<WSchema>, options?: CollectionInsertOneOptions): Promise<CollectionInsertOneResult<RSchema>> {
    return this.#commands.insertOne(document, options);
  }

  /**
   * ##### Overview
   *
   * Inserts many documents into the collection.
   *
   * See {@link CollectionInsertManyOptions} and {@link CollectionInsertManyResult} as well for more information.
   *
   * @example
   * ```ts
   * import { uuid } from '@datastax/astra-db-ts';
   *
   * await collection.insertMany([
   *   { _id: uuid.v4(), name: 'John Doe' }, // or UUID.v4()
   *   { name: 'Jane Doe' },
   * ]);
   * ```
   *
   * ---
   *
   * ##### Chunking
   *
   * > **🚨Important:** This function inserts documents in chunks to avoid exceeding insertion limits, which means it may make multiple requests to the server. As a result, this operation is **not necessarily atomic.**
   * >
   * > If the dataset is large or the operation is ordered, it may take a relatively significant amount of time. During this time, documents inserted by other concurrent processes may be written to the database, potentially causing duplicate id conflicts. In such cases, it's not guaranteed which write will succeed.
   *
   * By default, it inserts documents in chunks of 50 at a time. You can fine-tune the parameter through the `chunkSize` option. Note that increasing chunk size won't always increase performance. Instead, increasing concurrency may help.
   *
   * You can set the `concurrency` option to control how many network requests are made in parallel on unordered insertions. Defaults to `8`.
   *
   * @example
   * ```ts
   * const docs = Array.from({ length: 100 }, (_, i) => ({ _id: i }));
   * await collection.insertMany(docs, { concurrency: 16 });
   * ```
   *
   * ---
   *
   * ##### Ordered insertion
   *
   * You may set the `ordered` option to `true` to stop the operation after the first error; otherwise documents may be parallelized and processed in arbitrary order, improving, perhaps vastly, performance.
   *
   * Setting the `ordered` operation disables any parallelization so insertions truly are stopped after the very first error.
   *
   * @example
   * ```ts
   * // Will throw an InsertManyError after the 2nd doc is inserted with a duplicate key;
   * // the 3rd doc will never attempt to be inserted
   * await collection.insertMany([
   *   { _id: '1', name: 'John Doe' },
   *   { _id: '1', name: 'John Doe' },
   *   { _id: '2', name: 'Jane Doe' },
   * ], {
   *   ordered: true,
   * });
   * ```
   *
   * ---
   *
   * ##### The `_id` field
   *
   * If the document does not contain an `_id` field, the server will **generate an _id** for the document.
   * - The type of the generated id may be specified in {@link CollectionDefinition.defaultId} at collection creation, otherwise it'll just be a raw UUID string.
   * - This generation does not mutate the document.
   *
   * If an `_id` is provided which corresponds to a document that already exists in the collection, a {@link DataAPIResponseError} is raised, and the insertion fails.
   *
   * > **💡Tip:** See {@link SomeId} for much more information on the `_id` field.
   *
   * @example
   * ```typescript
   * // Insert documents with autogenerated IDs
   * await collection.insertMany([
   *   { name: 'John Doe' },
   *   { name: 'Jane Doe' },
   * ]);
   *
   * // Use the inserted IDs (generated or not)
   * const resp = await collection.insertMany([
   *   { name: 'Lemmy' },
   *   { name: 'Kilmister' },
   * ]);
   * console.log(resp.insertedIds); // will be string UUIDs
   *
   * // Or if the collection has a default ID
   * const collection = db.createCollection('users', {
   *   defaultId: { type: 'objectId' },
   * });
   *
   * const resp = await collection.insertMany([
   *   { name: 'Lynyrd' },
   *   { name: 'Skynyrd' },
   * ]);
   * console.log(resp.insertedIds[0].getTimestamp()); // will be ObjectIds
   * ```
   *
   * ---
   *
   * ##### `CollectionInsertManyError`
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
   *
   * @see CollectionInsertManyOptions
   * @see CollectionInsertManyResult
   */
  public async insertMany(documents: readonly MaybeId<WSchema>[], options?: CollectionInsertManyOptions): Promise<CollectionInsertManyResult<RSchema>> {
    return this.#commands.insertMany(documents, options, CollectionInsertManyError);
  }

  /**
   * ##### Overview
   *
   * Atomically updates a single document in the collection.
   *
   * See {@link CollectionFilter}, {@link CollectionUpdateFilter}, {@link CollectionUpdateOneOptions}, and {@link CollectionUpdateOneResult} as well for more information.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.updateOne({ _id: '1' }, { $set: { name: 'Jane Doe' } });
   * ```
   *
   * ---
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.updateOne(
   *   { _id: 42 },
   *   { $set: { age: 27 }, $setOnInsert: { name: 'Kasabian' } },
   *   { upsert: true },
   * );
   *
   * if (resp.upsertedCount) {
   *   console.log(resp.upsertedId); // 42
   * }
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ---
   *
   * ##### Update by vector search
   *
   * If the collection has vector search enabled, you can update the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await collection.updateOne(
   *   { optionalFilter },
   *   { $set: { name: 'Jane Doe', $vectorize: 'Come out and play' } },
   *   { sort: { $vector: [.09, .58, .21] } },
   * );
   * ```
   *
   * @param filter - A filter to select the document to update.
   * @param update - The update to apply to the selected document.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   *
   * @see CollectionFilter
   * @see CollectionUpdateFilter
   * @see CollectionUpdateOneOptions
   * @see CollectionUpdateOneResult
   */
  public async updateOne(filter: CollectionFilter<WSchema>, update: CollectionUpdateFilter<WSchema>, options?: CollectionUpdateOneOptions): Promise<CollectionUpdateOneResult<RSchema>> {
    return this.#commands.updateOne(filter, update, options);
  }

  /**
   * ##### Overview
   *
   * Updates many documents in the collection.
   *
   * See {@link CollectionFilter}, {@link CollectionUpdateFilter}, {@link CollectionUpdateManyOptions}, and {@link CollectionUpdateManyResult} as well for more information.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 30 },
   *   { name: 'Jane Doe', age: 30 },
   * ]);
   * await collection.updateMany({ age: 30 }, { $set: { age: 31 } });
   * ```
   * ---
   *
   * ##### Pagination
   *
   * > **🚨Important:** This function paginates the updating of documents due to server update limits, which means it may make multiple requests to the server. As a result, this operation is **not necessarily atomic**.
   * >
   * > Depending on the amount of matching documents, it can keep running (in a blocking manner) for a macroscopic amount of time. During this time, documents that are modified/inserted from another concurrent process/application may be modified/inserted during the execution of this method call.
   *
   * ---
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
   *   { name: 'Kasabian' },
   *   { $set: { age: 27 }, $setOnInsert: { _id: 42 } },
   *   { upsert: true },
   * );
   *
   * if (resp.upsertedCount) {
   *   console.log(resp.upsertedId); // 42
   * }
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **🚨Important:** If the filter is empty, _all documents in the collection will (non-atomically) be updated_. Proceed with caution.
   *
   * @param filter - A filter to select the documents to update.
   * @param update - The update to apply to the selected documents.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   *
   * @see CollectionFilter
   * @see CollectionUpdateFilter
   * @see CollectionUpdateManyOptions
   * @see CollectionUpdateManyResult
   */
  public async updateMany(filter: CollectionFilter<WSchema>, update: CollectionUpdateFilter<WSchema>, options?: CollectionUpdateManyOptions): Promise<CollectionUpdateManyResult<RSchema>> {
    return this.#commands.updateMany(filter, update, options, (e, result) => new CollectionUpdateManyError(e, result));
  }

  /**
   * ##### Overview
   *
   * Replaces a single document in the collection.
   *
   * See {@link CollectionFilter}, {@link CollectionReplaceOneOptions}, and {@link CollectionReplaceOneResult} as well for more information.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.replaceOne({ _id: '1' }, { name: 'Dohn Joe' });
   * ```
   *
   * ---
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.replaceOne(
   *   { _id: 42 },
   *   { name: 'Jessica' },
   *   { upsert: true },
   * );
   *
   * if (resp.upsertedCount) {
   *   console.log(resp.upsertedId); // 42
   * }
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ---
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
   *   { optionalFilter },
   *   { name: 'Jane Doe', $vectorize: 'Come out and play' },
   *   { sort: { $vector: [.11, .53, .31] } },
   * );
   * ```
   *
   * @param filter - A filter to select the document to replace.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for this operation.
   *
   * @returns A summary of what changed.
   *
   * @see CollectionFilter
   * @see CollectionReplaceOneOptions
   * @see CollectionReplaceOneResult
   */
  public async replaceOne(filter: CollectionFilter<WSchema>, replacement: NoId<WSchema>, options?: CollectionReplaceOneOptions): Promise<CollectionReplaceOneResult<RSchema>> {
    return this.#commands.replaceOne(filter, replacement, options);
  }

  /**
   * ##### Overview
   *
   * Atomically deletes a single document from the collection.
   *
   * See {@link CollectionFilter}, {@link CollectionDeleteOneOptions}, and {@link CollectionDeleteOneResult} as well for more information.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.deleteOne({ name: 'John Doe' });
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ---
   *
   * ##### Delete by vector search
   *
   * If the collection has vector search enabled, you can delete the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await collection.insertOne({ name: 'John Doe', $vector: [.12, .52, .32] });
   * await collection.deleteOne({}, { sort: { $vector: [.11, .53, .31] }});
   * ```
   *
   * @param filter - A filter to select the document to delete.
   * @param options - The options for this operation.
   *
   * @returns How many documents were deleted.
   *
   * @see CollectionFilter
   * @see CollectionDeleteOneOptions
   * @see CollectionDeleteOneResult
   */
  public async deleteOne(filter: CollectionFilter<WSchema>, options?: CollectionDeleteOneOptions): Promise<CollectionDeleteOneResult> {
    return this.#commands.deleteOne(filter, options);
  }

  /**
   * ##### Overview
   *
   * Deletes many documents from the collection.
   *
   * See {@link CollectionFilter}, {@link CollectionDeleteManyOptions}, and {@link CollectionDeleteManyResult} as well for more information.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1 },
   *   { name: 'John Doe', age: 2 },
   * ]);
   * await collection.deleteMany({ name: 'John Doe' });
   * ```
   *
   * ---
   *
   * ##### Pagination
   *
   * > **🚨Important:** This function paginates the deletion of documents due to server deletion limits, which means it may make multiple requests to the server. As a result, this operation is **not necessarily atomic**.
   * >
   * > Depending on the amount of matching documents, it can keep running (in a blocking manner) for a macroscopic amount of time. During this time, documents that are modified/inserted from another concurrent process/application may be modified/inserted during the execution of this method call.
   *
   * ---
   *
   * ##### 🚨Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **🚨Important:** If an empty filter is passed, **all documents in the collection will atomically be deleted in a single API call**. Proceed with caution.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe' },
   *   { name: 'Jane Doe' },
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
   *
   * @see CollectionFilter
   * @see CollectionDeleteManyOptions
   * @see CollectionDeleteManyResult
   */
  public async deleteMany(filter: CollectionFilter<WSchema>, options?: CollectionDeleteManyOptions): Promise<CollectionDeleteManyResult> {
    return this.#commands.deleteMany(filter, options, (e, result) => new CollectionDeleteManyError(e, result));
  }

  /**
   * ##### Overview
   *
   * Find documents in the collection, optionally matching the provided filter.
   *
   * See {@link CollectionFilter}, {@link CollectionFindOptions}, and {@link FindCursor} as well for more information.
   *
   * @example
   * ```ts
   * const cursor = await collection.find({ name: 'John Doe' }, { sort: { age: 1 } });
   * const docs = await cursor.toArray();
   * ```
   *
   * @example
   * ```ts
   * const cursor = await collection.find({})
   *   .sort({ age: 1 })
   *   .project<{ name: string }>({ name: 1 })
   *   .map(doc => doc.name);
   *
   * // ['John Doe', 'Jane Doe', ...]
   * const names = await cursor.toArray();
   * ```
   *
   * ---
   *
   * ##### Projection
   *
   * > **🚨Important:** When projecting, it is _heavily_ recommended to provide an explicit type override representing the projected schema, to prevent any type-mismatches when the schema is strictly provided.
   * >
   * > Otherwise, the documents will be typed as the full `Schema`, which may lead to runtime errors when trying to access properties that are not present in the projected documents.
   *
   * > **💡Tip:** Use the {@link Pick} or {@link Omit} utility types to create a type representing the projected schema.
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
   * // --- Not providing a type override ---
   *
   * const cursor = await collection.find({}, {
   *   projection: { car: 1 },
   * });
   *
   * const next = await cursor.next();
   * console.log(next.car.make); // OK
   * console.log(next.name); // Uh oh! Runtime error, since tsc doesn't complain
   *
   * // --- Explicitly providing the projection type ---
   *
   * const cursor = await collection.find<Pick<User, 'car'>>({}, {
   *   projection: { car: 1 },
   * });
   *
   * const next = await cursor.next();
   * console.log(next.car.make); // OK
   * console.log(next.name); // Type error; won't compile
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the documents. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, all documents in the collection will be returned (up to any provided or server limit).
   *
   * ---
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
   *   { name: 'John Doe', $vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
   * ]);
   *
   * const cursor = collection.find({}, {
   *   sort: { $vector: [.12, .52, .32] },
   * });
   *
   * // Returns 'John Doe'
   * console.log(await cursor.next());
   * ```
   *
   * ---
   *
   * ##### Sorting
   *
   * The sort option can be used to sort the documents returned by the cursor. See {@link Sort} for more information.
   *
   * If the sort option is not provided, there is no guarantee as to the order of the documents returned.
   *
   * > **🚨Important:** When providing a non-vector sort, the Data API will return a smaller number of documents (20, at the time of writing), and stop there. The returned documents are the top results across the whole collection according to the requested criterion.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const cursor = collection.find({}, {
   *   sort: { age: 1, height: -1 },
   * });
   *
   * // Returns 'John Doe' (age 2, height 42), 'John Doe' (age 1, height 168)
   * console.log(await cursor.toArray());
   * ```
   *
   * ---
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
   *   .sort({ $vector: [.12, .52, .32] })
   *   .projection<{ name: string, age: number }>({ name: 1, age: 1 })
   *   .includeSimilarity(true)
   *   .map(doc => `${doc.name} (${doc.age})`);
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
   * @returns a FindCursor which can be iterated over.
   *
   * @see CollectionFilter
   * @see CollectionFindOptions
   * @see FindCursor
   */
  public find<T extends SomeDoc = WithSim<RSchema>, TRaw extends T = T>(filter: CollectionFilter<WSchema>, options?: CollectionFindOptions): CollectionFindCursor<T, TRaw> {
    return this.#commands.find(filter, options, CollectionFindCursor) as CollectionFindCursor<T, TRaw>;
  }

  /**
   * ##### Overview (preview)
   *
   * Finds documents in a collection through a retrieval process that uses a reranker model to combine results from a vector similarity search and a lexical-based search (aka a "hybrid search").
   *
   * @example
   * ```ts
   * // With vectorize
   * const cursor = await coll.findAndRerank({})
   *   .sort({ $hybrid: 'what is a dog?' })
   *   .includeScores();
   *
   * // Using your own vectors
   * const cursor = await coll.findAndRerank({})
   *   .sort({ $hybrid: { $vector: vector([...]), $lexical: 'what is a dog?' } })
   *   .rerankOn('$lexical')
   *   .rerankQuery('I like dogs');
   *
   * for await (const res of cursor) {
   *   console.log(cursor.document, cursor.scores);
   * }
   * ```
   */
  public findAndRerank<T extends SomeDoc = RSchema, TRaw extends T = T>(filter: CollectionFilter<WSchema>, options?: CollectionFindAndRerankOptions): CollectionFindAndRerankCursor<RerankedResult<T>, TRaw> {
    return this.#commands.findAndRerank(filter, options, CollectionFindAndRerankCursor) as CollectionFindAndRerankCursor<RerankedResult<T>, TRaw>;
  }

  /**
   * ##### Overview
   *
   * Find a single document in the collection, optionally matching the provided filter.
   *
   * See {@link CollectionFilter} and {@link CollectionFindOneOptions} as well for more information.
   *
   * @example
   * ```ts
   * const doc = await collection.findOne({ name: 'John Doe' });
   * ```
   *
   * ---
   *
   * ##### Projection
   *
   * > **🚨Important:** When projecting, it is _heavily_ recommended to provide an explicit type override representing the projected schema, to prevent any type-mismatches when the schema is strictly provided.
   * >
   * > Otherwise, the document will be typed as the full `Schema`, which may lead to runtime errors when trying to access properties that are not present in the projected document.
   *
   * > **💡Tip:** Use the {@link Pick} or {@link Omit} utility types to create a type representing the projected schema.
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
   *
   * // --- Not providing a type override ---
   *
   * const doc = await collection.findOne({}, {
   *   projection: { car: 1 },
   * });
   *
   * console.log(doc.car.make); // OK
   * console.log(doc.name); // Uh oh! Runtime error, since tsc doesn't complain
   *
   * // --- Explicitly providing the projection type ---
   *
   * const doc = await collection.findOne<Pick<User, 'car'>>({}, {
   *   projection: { car: 1 },
   * });
   *
   * console.log(doc.car.make); // OK
   * console.log(doc.name); // Type error; won't compile
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ##### Find by vector search
   *
   * If the collection has vector search enabled, you can find the most relevant document by providing a vector in the sort option.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', $vector: [.12, .52, .32] },
   *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
   *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
   * ]);
   *
   * const doc = collection.findOne({}, {
   *   sort: { $vector: [.12, .52, .32] },
   * });
   *
   * // 'John Doe'
   * console.log(doc.name);
   * ```
   *
   * ##### Sorting
   *
   * The sort option can be used to pick the most relevant document. See {@link Sort} for more information.
   *
   * If the sort option is not provided, there is no guarantee as to which of the documents which matches the filter is returned.
   *
   * @example
   * ```ts
   * await collection.insertMany([
   *   { name: 'John Doe', age: 1, height: 168 },
   *   { name: 'John Doe', age: 2, height: 42 },
   * ]);
   *
   * const doc = collection.findOne({}, {
   *   sort: { age: 1, height: -1 },
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
   *
   * @see CollectionFilter
   * @see CollectionFindOneOptions
   */
  public async findOne<TRaw extends SomeDoc = WithSim<RSchema>>(filter: CollectionFilter<WSchema>, options?: CollectionFindOneOptions): Promise<TRaw | null> {
    return this.#commands.findOne(filter, options);
  }

  /**
   * ##### Overview
   *
   * Return a list of the unique values of `key` across the documents in the collection that match the provided filter.
   *
   * See {@link CollectionFilter} and {@link CollectionDistinctOptions} as well for more information.
   *
   * @example
   * ```ts
   * const docs = await collection.distinct('name');
   * ```
   *
   * ---
   *
   * ##### Major disclaimer 🚨
   *
   * > **🚨Important:** This is a **client-side operation**.
   * >
   * > This method browses all matching documents (albeit with a projection) using the logic of the {@link Collection.find} method, and collects the unique value for the given `key` manually.
   * >
   * > As such, there may be performance, latency, and ultimately billing implications if the amount of matching documents is large.
   * >
   * > Therefore, it is **heavily recommended** to only use this method on **small datasets**, or a **strict filter**.
   *
   * ---
   *
   * ##### Usage
   *
   * The key may use dot-notation to access nested fields, such as `'field'`, `'field.subfield'`, `'field.3'`, `'field.3.subfield'`, etc. If lists are encountered and no numeric index is specified, all items in the list are pulled.
   *
   * > **✏️Note:** On complex extractions, the return type may be not as expected.** In that case, it's on the user to cast the return type to the correct one.
   *
   * Distinct works with arbitrary objects as well, by stable-y stringifying the object and comparing it with the string representations of the objects already seen.
   * - This, unsurprisingly, may not be great for performance if you have a lot of records that match, so it's **recommended to use distinct on simple values** whenever performance or number of records is a concern.
   *
   * For details on the behavior of "distinct" in conjunction with real-time changes in the collection contents, see the remarks on the `find` command.
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { letter: { value: 'a' }, car: [1] },
   *   { letter: { value: 'b' }, car: [2, 3] },
   *   { letter: { value: 'a' }, car: [2], bus: 'no' },
   * ]);
   *
   * // ['a', 'b']
   * const distinct = await collection.distinct('letter.value');
   *
   * await collection.insertOne({
   *   x: [{ y: 'Y', 0: 'ZERO' }],
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
   *
   * @see CollectionFilter
   * @see CollectionDistinctOptions
   */
  public async distinct<Key extends string>(key: Key, filter: CollectionFilter<WSchema>, options?: CollectionDistinctOptions): Promise<Flatten<(SomeDoc & ToDotNotation<RSchema>)[Key]>[]> {
    return this.#commands.distinct(key, filter, options, CollectionFindCursor, { _id: 0 });
  }

  /**
   * ##### Overview
   *
   * Counts the number of documents in the collection, optionally with a filter.
   *
   * See {@link CollectionFilter} and {@link CollectionCountDocumentsOptions} as well for more information.
   *
   * @example
   * ```ts
   * const count = await collection.countDocuments({ name: 'John Doe' }, 1000);
   * ```
   *
   * ---
   *
   * ##### The `limit` parameter 🚨
   *
   * > **🚨Important:** This operation takes in a `limit` option which dictates the maximum number of documents that may be present before a {@link TooManyDocumentsToCountError} is thrown.
   * >
   * > If the limit is higher than the highest limit accepted by the Data API (i.e. `1000`), a {@link TooManyDocumentsToCountError} will be thrown anyway.
   *
   * @example
   * ```typescript
   * await collection.insertMany([
   *   { name: 'John Doe' },
   *   { name: 'Jane Doe' },
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
   *
   * @see CollectionFilter
   * @see CollectionCountDocumentsOptions
   */
  public async countDocuments(filter: CollectionFilter<WSchema>, upperBound: number, options?: CollectionCountDocumentsOptions): Promise<number> {
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
   * However, this operation is faster than {@link Collection.countDocuments}, and while it doesn't
   * accept a filter, **it can handle any number of documents.**
   *
   * See {@link CollectionEstimatedDocumentCountOptions} as well for more information.
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
   *
   * @see CollectionEstimatedDocumentCountOptions
   */
  public async estimatedDocumentCount(options?: CollectionEstimatedDocumentCountOptions): Promise<number> {
    return this.#commands.estimatedDocumentCount(options);
  }

  /**
   * ##### Overview
   *
   * Atomically finds a single document in the collection and replaces it.
   *
   * See {@link CollectionFilter} and {@link CollectionFindOneAndReplaceOptions} as well for more information.
   *
   * @example
   * ```typescript
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.findOneAndReplace({ _id: '1' }, { name: 'Dohn Joe' });
   * ```
   *
   * ---
   *
   * ##### Projection
   *
   * > **🚨Important:** When projecting, it is _heavily_ recommended to provide an explicit type override representing the projected schema, to prevent any type-mismatches when the schema is strictly provided.
   * >
   * > Otherwise, the returned document will be typed as the full `Schema`, which may lead to runtime errors when trying to access properties that are not present in the projected document.
   *
   * > **💡Tip:** Use the {@link Pick} or {@link Omit} utility types to create a type representing the projected schema.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe', age: 3 });
   *
   * const doc = await collection.findOneAndReplace<{ name: string }>(
   *   { _id: '1' },
   *   { name: 'Dohn Joe' },
   *   { projection: { name: 1, _id: 0 } },
   * );
   *
   * // Prints { name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * ---
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.findOneAndReplace(
   *   { _id: 42 },
   *   { name: 'Jessica' },
   *   { upsert: true },
   * );
   *
   * console.log(resp); // null, b/c no previous document was found
   * ```
   *
   * ---
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
   *   { _id: '1' },
   *   { name: 'Jane Doe' },
   *   { returnDocument: 'after' },
   * );
   *
   * // Prints { _id: '1', name: 'Jane Doe' }
   * console.log(after);
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ---
   *
   * ##### Find one and replace by vector search
   *
   * If the collection has vector search enabled, you can replace the most relevant document by providing a vector in the sort option.
   *
   * See {@link Collection.replaceOne} for a concrete example.
   *
   * @param filter - A filter to select the document to find.
   * @param replacement - The replacement document, which contains no `_id` field.
   * @param options - The options for this operation.
   *
   * @returns The document before/after replacement, depending on the type of `returnDocument`
   *
   * @see CollectionFilter
   * @see CollectionFindOneAndReplaceOptions
   */
  public async findOneAndReplace<TRaw extends SomeDoc = RSchema>(filter: CollectionFilter<WSchema>, replacement: NoId<WSchema>, options?: CollectionFindOneAndReplaceOptions): Promise<TRaw | null> {
    return this.#commands.findOneAndReplace(filter, replacement, options);
  }

  /**
   * ##### Overview
   *
   * Atomically finds a single document in the collection and deletes it.
   *
   * See {@link CollectionFilter} and {@link CollectionFindOneAndDeleteOptions} as well for more information.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.findOneAndDelete({ _id: '1' });
   * ```
   *
   * ---
   *
   * ##### Projection
   *
   * > **🚨Important:** When projecting, it is _heavily_ recommended to provide an explicit type override representing the projected schema, to prevent any type-mismatches when the schema is strictly provided.
   * >
   * > Otherwise, the returned document will be typed as the full `Schema`, which may lead to runtime errors when trying to access properties that are not present in the projected document.
   *
   * > **💡Tip:** Use the {@link Pick} or {@link Omit} utility types to create a type representing the projected schema.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe', age: 3 });
   *
   * const doc = await collection.findOneAndDelete<{ name: string }>(
   *   { _id: '1' },
   *   { projection: { name: 1, _id: 0 } },
   * );
   *
   * // Prints { name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ---
   *
   * ##### Find one and delete by vector search
   *
   * If the collection has vector search enabled, you can delete the most relevant document by providing a vector in the sort option.
   *
   * See {@link Collection.deleteOne} for a concrete example.
   *
   * @param filter - A filter to select the document to find.
   * @param options - The options for this operation.
   *
   * @returns The deleted document, or `null` if no document was found.
   *
   * @see CollectionFilter
   * @see CollectionFindOneAndDeleteOptions
   */
  public async findOneAndDelete<TRaw extends SomeDoc = RSchema>(filter: CollectionFilter<WSchema>, options?: CollectionFindOneAndDeleteOptions): Promise<TRaw | null> {
    return this.#commands.findOneAndDelete(filter, options);
  }

  /**
   * ##### Overview
   *
   * Atomically finds a single document in the collection and updates it.
   *
   * See {@link CollectionFilter} and {@link CollectionFindOneAndUpdateOptions} as well for more information.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe' });
   * await collection.findOneAndUpdate({ _id: '1' }, { $set: { name: 'Jane Doe' } });
   * ```
   *
   * ---
   *
   * ##### Projection
   *
   * > **🚨Important:** When projecting, it is _heavily_ recommended to provide an explicit type override representing the projected schema, to prevent any type-mismatches when the schema is strictly provided.
   * >
   * > Otherwise, the returned document will be typed as the full `Schema`, which may lead to runtime errors when trying to access properties that are not present in the projected document.
   *
   * > **💡Tip:** Use the {@link Pick} or {@link Omit} utility types to create a type representing the projected schema.
   *
   * @example
   * ```ts
   * await collection.insertOne({ _id: '1', name: 'John Doe', age: 3 });
   *
   * const doc = await collection.findOneAndUpdate<{ name: string }>(
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' } },
   *   { projection: { name: 1, _id: 0 } },
   * );
   *
   * // Prints { name: 'John Doe' }
   * console.log(doc);
   * ```
   *
   * ---
   *
   * ##### Upserting
   *
   * If `upsert` is set to true, it will insert the document reconstructed from the filter & the update filter if no match is found.
   *
   * @example
   * ```ts
   * const resp = await collection.findOneAndUpdate(
   *   { _id: 42 },
   *   { $set: { name: 'Jessica' } },
   *   { upsert: true },
   * );
   *
   * console.log(resp); // null, b/c no previous document was found
   * ```
   *
   * ---
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
   *   { _id: '1' },
   *   { $set: { name: 'Jane Doe' } },
   *   { returnDocument: 'after' },
   * );
   *
   * // Prints { _id: '1', name: 'Jane Doe' }
   * console.log(after);
   * ```
   *
   * ---
   *
   * ##### Filtering
   *
   * The filter can contain a variety of operators & combinators to select the document. See {@link CollectionFilter} for much more information.
   *
   * > **⚠️Warning:** If the filter is empty, and no {@link Sort} is present, it's undefined as to which document is selected.
   *
   * ---
   *
   * ##### Find one and update by vector search
   *
   * If the collection has vector search enabled, you can update the most relevant document by providing a vector in the sort option.
   *
   * See {@link Collection.updateOne} for a concrete example.
   *
   * @param filter - A filter to select the document to find.
   * @param update - The update to apply to the selected document.
   * @param options - The options for this operation.
   *
   * @returns The document before/after the update, depending on the type of `returnDocument`
   */
  public async findOneAndUpdate<TRaw extends SomeDoc = RSchema>(filter: CollectionFilter<WSchema>, update: CollectionUpdateFilter<WSchema>, options?: CollectionFindOneAndUpdateOptions): Promise<TRaw | null> {
    return this.#commands.findOneAndUpdate(filter, update, options);
  }

  /**
   * ##### Overview
   *
   * Get the collection options, i.e. its configuration as read from the database.
   *
   * The method issues a request to the Data API each time it is invoked, without caching mechanisms; this ensures up-to-date information for usages such as real-time collection validation by the application.
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
  public async options(options?: CommandOptions<{ timeout: 'collectionAdminTimeoutMs' }>): Promise<CollectionDefinition<SomeDoc>> {
    const resp = await this.#db.listCollections({ ...options, keyspace: this.keyspace });

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
   * ---
   *
   * ##### Disclaimer 🚨
   *
   * > **🚨Important:** Once the collection is dropped, this object is still technically "usable", but any further operations on it will fail at the Data API level; thus, it's the user's responsibility to make sure that the {@link Collection} object is no longer used.
   *
   * @param options - The options for this operation.
   *
   * @returns A promise which resolves when the collection has been dropped.
   *
   * @remarks Use with caution. Wear your safety goggles. Don't say I didn't warn you.
   */
  public async drop(options?: Omit<DropCollectionOptions, keyof WithKeyspace>): Promise<void> {
    await this.#db.dropCollection(this.name, { keyspace: this.keyspace, ...options });
  }

  /**
   * Backdoor to the HTTP client for if it's absolutely necessary. Which it almost never (if even ever) is.
   */
  public get _httpClient(): OpaqueHttpClient {
    return this.#httpClient;
  }

  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - `bulkWrite` has been removed until it is supported on the server side by the Data API. Please manually perform equivalent collection operations to attain the same behavior.
   */
  public declare bulkWrite: 'ERROR: `bulkWrite` has been removed; manually perform collection operations to retain the same behavior';

  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - `deleteAll` has been removed to retain Data API consistency. Use `deleteMany({})` instead to retain the same behavior.
   */
  public declare deleteAll: 'ERROR: `deleteAll` has been removed; use `deleteMany({})` instead';
}
