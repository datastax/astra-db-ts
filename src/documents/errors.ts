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

import type { FetcherResponseInfo, RawDataAPIResponse, TimeoutDescriptor } from '@/src/lib/index.js';
import type {
  CollectionDeleteManyResult,
  CollectionInsertManyResult,
  CollectionUpdateManyResult,
  SomeDoc,
} from '@/src/documents/collections/index.js';
import type { TableInsertManyResult } from '@/src/documents/tables/index.js';
import type { HTTPRequestInfo } from '@/src/lib/api/clients/index.js';
import type { TimedOutCategories } from '@/src/lib/api/timeouts/timeouts.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { LitUnion } from '@/src/lib/types.js';

/**
 * ##### Overview
 *
 * An object representing a single "soft" (2XX) error returned from the Data API, typically with an error code and a
 * human-readable message. An API request may return with an HTTP 200 success error code, but contain a nonzero
 * amount of these, such as for duplicate inserts, or invalid IDs.
 *
 * ##### Disclaimer
 *
 * This is *not* used for "hard" (4XX, 5XX, timeout) errors, which are rarer and would be thrown directly by the underlying
 * code.
 *
 * @example
 * ```typescript
 * {
 *   family: 'REQUEST',
 *   scope: 'DOCUMENT',
 *   errorCode: 'MISSING_PRIMARY_KEY_COLUMNS',
 *   title: 'Primary key columns missing'
 *   id: 'f785ebb9-a375-4d96-842f-31e23a10a1a5',
 *   message: `
 *     All primary key columns must be provided when inserting a document into a table.
 *
 *     The table default_keyspace.test_table defines the primary key columns:
 *       text(text), int(int).
 *
 *     The command included values for primary key columns: [None].
 *     The command did not include values for primary key columns: int(int), text(text).
 *
 *     Resend the command including the missing primary key columns.
 *   `,
 * }
 * ```
 *
 * @field id - A unique identifier for this instance of the error.
 * @field family - Informs if the error was due to their request or server side processing.
 * @field scope - Informs what area of the request failed.
 * @field errorCode - Informs the exact error that occurred.
 * @field title - A short, human-readable summary of the error.
 * @field message - A longer human-readable description of the error.
 *
 * @public
 */
export interface DataAPIErrorDescriptor {
  /**
   * A unique UUID V4 identifier for this instance of the error.
   */
  readonly id: string,
  /**
   * Top level of the hierarchy of errors.
   *
   * Informs if the error was due to their request or server side processing.
   *
   * Expected to only ever be `'REQUEST' | 'SERVER'`, but left open for unlikely future expansion.
   */
  readonly family: LitUnion<'REQUEST' | 'SERVER'>,
  /**
   * Optional, second level of the hierarchy of errors.
   *
   * Informs what area of the request failed.
   *
   * Will be something like `'DATABASE'`, `'EMBEDDING'`, `'FILTER'`, `'DOCUMENT'`, `'AUTHORIZATION'`, etc.
   */
  readonly scope?: string,
  /**
   * Leaf level of the hierarchy of errors.
   *
   * Informs the exact error that occurred.
   *
   * Error codes will be unique within the combination of family and scope, at the very least.
   * - (They will most likely be unique across the entire API).
   *
   * Will be something like `'DOCUMENT_ALREADY_EXISTS'`, `'MISSING_PRIMARY_KEY_COLUMNS'`, etc.
   */
  readonly errorCode: string,
  /**
   * A short, human-readable summary of the error.
   *
   * The title will NOT change for between instances of the same error code.
   *
   * _(that is, every instance of the MULTIPLE_ID_FILTER error returned by the API will have the same title)_.
   *
   * Will be something like
   * - `'Primary key columns missing'`
   * - `'Document already exists with the given _id'`
   * - etc.
   */
  readonly title: string,
  /**
   * A longer human-readable description of the error that contains information specific to the error.
   *
   * **This may contain newlines and other formatting characters.**
   */
  readonly message: string,
}

/**
 * ##### Overview
 *
 * An object representing a *complete* error response from the Data API, including the original command that was sent,
 * and the raw API response from the server.
 *
 * ##### Disclaimer
 *
 * This is *not* used for "hard" (4XX, 5XX, timeout) errors, which are rarer and would be thrown directly by the underlying
 * code.
 *
 * @example
 * ```ts
 * [{
 *   errorDescriptors: [
 *     {
 *       family: 'REQUEST',
 *       scope: 'DOCUMENT',
 *       errorCode: 'DOCUMENT_ALREADY_EXISTS',
 *       id: 'e4be94b6-e8b5-4652-961b-5c9fe12d2f1a',
 *       title: 'Document already exists with the given _id',
 *       message: 'Document already exists with the given _id',
 *     },
 *   ],
 *   command: { insertOne: { document: { _id: '123213123kj21lj' } } },
 *   rawResponse: {
 *     status: { insertedIds: [] },
 *     errors: [...],
 *   },
 * }]
 * ```
 *
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field command - The raw command send to the API
 * @field rawResponse - The raw response from the API
 *
 * @public
 */
export interface DataAPIDetailedErrorDescriptor {
  /**
   * A list of error descriptors representing the individual errors returned by the API.
   *
   * This will likely be a singleton list in many cases, such as for `insertOne` or `deleteOne` commands, but may be
   * longer for bulk operations like `insertMany` which may have multiple insertion errors.
   */
  readonly errorDescriptors: readonly DataAPIErrorDescriptor[],
  /**
   * The original command that was sent to the API, as a plain object. This is the *raw* command, not necessarily in
   * the exact format the client may use, in some rare cases.
   *
   * @example
   * ```typescript
   * {
   *   insertOne: {
   *     document: { _id: 'doc10', name: 'Document 10' },
   *   },
   * }
   * ```
   */
  readonly command: Record<string, any>,
  /**
   * The raw response from the API
   *
   * @example
   * ```typescript
   * {
   *   status: {
   *     insertedIds: [ 'id1', 'id2', 'id3']
   *   },
   *   errors: [
   *     {
   *       family: 'REQUEST',
   *       scope: 'DOCUMENT',
   *       errorCode: 'DOCUMENT_ALREADY_EXISTS',
   *       id: 'e4be94b6-e8b5-4652-961b-5c9fe12d2f1a',
   *       title: 'Document already exists with the given _id',
   *       message: 'Document already exists with the given _id',
   *     },
   *   ]
   * }
   * ```
   */
  readonly rawResponse: RawDataAPIResponse,
}

/**
 * An abstract class representing *some* exception that occurred related to the Data API. This is the base class for all
 * Data API errors, and will never be thrown directly.
 *
 * Useful for `instanceof` checks.
 *
 * This is *only* for Data API related errors, such as a non-existent collections, or a duplicate key error. It
 * is *not*, however, for errors such as an HTTP network error, or a malformed request. The exception being timeouts,
 * which are represented by the {@link DataAPITimeoutError} class.
 *
 * @public
 */
export abstract class DataAPIError extends Error {}

/**
 * An error thrown on non-2XX status codes from the Data API, such as 4XX or 5XX errors.
 *
 * @public
 */
export class DataAPIHttpError extends DataAPIError {
  /**
   * The error descriptors returned by the API to describe what went wrong.
   */
  public readonly status: number;

  /**
   * The raw string body of the HTTP response, if it exists
   */
  public readonly body?: string;

  /**
   * The "raw", errored response from the API.
   */
  public readonly raw: FetcherResponseInfo;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(resp: FetcherResponseInfo) {
    super(`HTTP error (${resp.status}): ${resp.body ? resp.body : resp.statusText}`);
    this.status = resp.status;
    this.body = resp.body;
    this.raw = resp;
    this.name = 'DataAPIHttpError';
  }
}

/**
 * An error thrown when a Data API operation timed out.
 *
 * Depending on the method, this may be a request timeout occurring during a specific HTTP request, or can happen over
 * the course of a method involving several requests in a row, such as a paginated `insertMany`.
 *
 * @public
 */
export class DataAPITimeoutError extends DataAPIError {
  /**
   * The timeout that was set for the operation, in milliseconds.
   */
  public readonly timeout: Partial<TimeoutDescriptor>;

  public readonly timedOutTypes: TimedOutCategories;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: HTTPRequestInfo, types: TimedOutCategories) {
    super(Timeouts.fmtTimeoutMsg(info.timeoutManager, types));
    this.timeout = info.timeoutManager.initial();
    this.timedOutTypes = types;
    this.name = 'DataAPITimeoutError';
  }

  /**
   * @internal
   */
  public static mk(this: void, info: HTTPRequestInfo, types: TimedOutCategories): DataAPITimeoutError {
    return new DataAPITimeoutError(info, types);
  }
}

/**
 * Caused by a `countDocuments` operation that failed because the resulting number of documents exceeded *either*
 * the upper bound set by the caller, or the hard limit imposed by the Data API.
 *
 * @example
 * ```typescript
 * await collections.insertMany('<100_length_array>');
 *
 * try {
 *   await collections.countDocuments({}, 50);
 * } catch (e) {
 *   if (e instanceof TooManyDocumentsToCountError) {
 *     console.log(e.limit); // 50
 *     console.log(e.hitServerLimit); // false
 *   }
 * }
 * ```
 *
 * @field limit - The limit that was set by the caller
 * @field hitServerLimit - Whether the server-imposed limit was hit
 *
 * @public
 */
export class TooManyDocumentsToCountError extends DataAPIError {
  /**
   * The limit that was specified by the caller, or the server-imposed limit if the caller's limit was too high.
   */
  public readonly limit: number;

  /**
   * Specifies if the server-imposed limit was hit. If this is `true`, the `limit` field will contain the server's
   * limit; otherwise it will contain the caller's limit.
   */
  public readonly hitServerLimit: boolean;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(limit: number, hitServerLimit: boolean) {
    const message = (hitServerLimit)
      ? `Too many documents to count (server limit of ${limit} reached)`
      : `Too many documents to count (provided limit is ${limit})`;
    super(message);
    this.limit = limit;
    this.hitServerLimit = hitServerLimit;
    this.name = 'TooManyDocumentsToCountError';
  }
}

/**
 * An error representing the *complete* errors for an operation. This is a cohesive error that represents all the
 * errors that occurred during a single operation, and should not be thought of as *always* 1:1 with the number of
 * API requests—rather it's 1:1 with the number of *logical* operations performed by the user (i.e. the methods
 * on the {@link Collection} class).
 *
 * This is *not* used for "hard" (4XX, 5XX) errors, which are rarer and would be thrown directly by the underlying
 * code.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 *
 * @public
 */
export class DataAPIResponseError extends DataAPIError {
  /**
   * A human-readable message describing the *first* error.
   *
   * This is *always* equal to `errorDescriptors[0]?.message` if it exists, otherwise it's given a generic
   * default message.
   */
  public readonly message!: string;

  /**
   * A list of error descriptors representing the individual errors returned by the API.
   *
   * This is *always* equal to `detailedErrorDescriptors.flatMap(d => d.errorDescriptors)`, for the user's
   * convenience.
   */
  public readonly errorDescriptors: DataAPIErrorDescriptor[];

  /**
   * A list of errors 1:1 with the number of errorful API requests made to the server. Each element contains the
   * original command, the raw response, and the error descriptors for that request.
   *
   * For operations that only make one request, this will be a singleton list (i.e. `insertOne`).
   */
  public readonly detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[];

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(detailedErrDescriptors: DataAPIDetailedErrorDescriptor[]) {
    const errorDescriptors = detailedErrDescriptors.flatMap(d => d.errorDescriptors);

    const message = (errorDescriptors[0]?.message)
      ? `${errorDescriptors[0].message}${errorDescriptors.length > 1 ? ` (+ ${errorDescriptors.length - 1} more errors)` : ''}`
      : `Something went wrong (${errorDescriptors.length} errors)`;

    super(message);
    this.message = message;
    this.errorDescriptors = errorDescriptors;
    this.detailedErrorDescriptors = detailedErrDescriptors;
    this.name = 'DataAPIResponseError';
  }
}

/**
 * An abstract class representing an exception that occurred due to a *cumulative* operation on the Data API. This is
 * the base class for all Data API errors that represent a paginated operation, such as `insertMany`, `deleteMany`, and
 * `updateMany`, and will never be thrown directly.
 *
 * Useful for `instanceof` checks.
 *
 * This is *only* for Data API related errors, such as a non-existent collections, or a duplicate key error. It
 * is *not*, however, for errors such as an HTTP network error, or a malformed request. The exception being timeouts,
 * which are represented by the {@link DataAPITimeoutError} class.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the operation that was performed
 *
 * @public
 */
export abstract class CumulativeOperationError extends DataAPIResponseError {
  /**
   * The partial result of the operation that was performed. This is *always* defined, and is
   * the result of the operation up to the point of the first error. For example, if you're inserting 100 documents
   * ordered and the 50th document fails, the `partialResult` will contain the first 49 documents that were
   * successfully inserted.
   */
  public readonly partialResult!: unknown;
}

/**
 * ##### Overview
 *
 * Represents an error that occurred during an `insertMany` operation (which may be paginated).
 *
 * Contains the inserted IDs of the documents that were successfully inserted, as well as the cumulative errors
 * that occurred during the operation.
 *
 * If the operation was ordered, the `insertedIds` will be in the same order as the documents that were attempted to
 * be inserted.
 *
 * @example
 * ```ts
 * try {
 *   await collection.insertMany([
 *     { _id: 'id1', desc: 'An innocent little document' },
 *     { _id: 'id2', name: 'Another little document minding its own business' },
 *     { _id: 'id2', name: 'A mean document commiting _identity theft' },
 *     { _id: 'id3', name: 'A document that will never see the light of day-tabase' },
 *   ], { ordered: true });
 * } catch (e) {
 *   if (e instanceof CollectionInsertManyError) {
 *     console.log(e.message); // "Document already exists with the given _id"
 *     console.log(e.partialResult.insertedIds); // ['id1', 'id2']
 *   }
 * }
 * ```
 *
 * ##### Collections vs Tables
 *
 * There is a sister {@link TableInsertManyError} class that is used for `insertMany` operations on tables. It's
 * identical in structure, but just uses the appropriate {@link TableInsertManyResult} type.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `InsertMany` operation that was performed
 *
 * @public
 */
export class CollectionInsertManyError extends CumulativeOperationError {
  /**
   * The name of the error. This is always 'InsertManyError'.
   */
  name = 'CollectionInsertManyError';

  /**
   * The partial result of the `InsertMany` operation that was performed. This is *always* defined, and is the result
   * of all successful insertions.
   */
  declare public readonly partialResult: CollectionInsertManyResult<SomeDoc>;
  //
  // /**
  //  * The specific statuses and ids for each document present in the `insertMany` command
  //  *
  //  * The position of each document response is the same as its corresponding document in the input `documents` array
  //  */
  // declare public readonly documentResponses: InsertManyDocumentResponse<SomeDoc>[];
  //
  // /**
  //  * The number of documents which failed insertion (i.e. their status in {@link InsertManyError.documentResponses} was
  //  * `'ERROR'` or `'SKIPPED'`)
  //  */
  // declare public readonly failedCount: number;
}

/**
 * Represents an error that occurred during an `insertMany` operation (which is, generally, paginated).
 *
 * Contains the inserted IDs of the documents that were successfully inserted, as well as the cumulative errors
 * that occurred during the operation.
 *
 * If the operation was ordered, the `insertedIds` will be in the same order as the documents that were attempted to
 * be inserted.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `InsertMany` operation that was performed
 *
 * @public
 */
export class TableInsertManyError extends CumulativeOperationError {
  /**
   * The name of the error. This is always 'InsertManyError'.
   */
  name = 'TableInsertManyError';

  /**
   * The partial result of the `InsertMany` operation that was performed. This is *always* defined, and is the result
   * of all successful insertions.
   */
  declare public readonly partialResult: TableInsertManyResult<SomeDoc>;
}

/**
 * Represents an error that occurred during a `deleteMany` operation (which is, generally, paginated).
 *
 * Contains the number of documents that were successfully deleted, as well as the cumulative errors that occurred
 * during the operation.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `DeleteMany` operation that was performed
 *
 * @public
 */
export class CollectionDeleteManyError extends CumulativeOperationError {
  /**
   * The name of the error. This is always 'DeleteManyError'.
   */
  name = 'CollectionDeleteManyError';

  /**
   * The partial result of the `DeleteMany` operation that was performed. This is *always* defined, and is the result
   * of the operation up to the point of the first error.
   */
  declare public readonly partialResult: CollectionDeleteManyResult;
}

/**
 * Represents an error that occurred during an `updateMany` operation (which is, generally, paginated).
 *
 * Contains the number of documents that were successfully matched and/or modified, as well as the cumulative errors
 * that occurred during the operation.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `UpdateMany` operation that was performed
 *
 * @public
 */
export class CollectionUpdateManyError extends CumulativeOperationError {
  /**
   * The name of the error. This is always 'UpdateManyError'.
   */
  name = 'CollectionUpdateManyError';

  /**
   * The partial result of the `UpdateMany` operation that was performed. This is *always* defined, and is the result
   * of the operation up to the point of the first error.
   */
  declare public readonly partialResult: CollectionUpdateManyResult<SomeDoc>;
}

/**
 * @internal
 */
export const mkRespErrorFromResponse = <E extends DataAPIResponseError>(err: new (descs: DataAPIDetailedErrorDescriptor[]) => E, command: Record<string, any>, raw: RawDataAPIResponse, attributes?: Omit<E, keyof DataAPIResponseError>) => {
  return mkRespErrorFromResponses(err, [command], [raw], attributes);
};

/**
 * @internal
 */
export const mkRespErrorFromResponses = <E extends DataAPIResponseError>(err: new (descs: DataAPIDetailedErrorDescriptor[]) => E, commands: Record<string, any>[], raw: RawDataAPIResponse[], attributes?: Omit<E, keyof DataAPIResponseError>) => {
  const detailedErrDescriptors = [] as DataAPIDetailedErrorDescriptor[];

  for (let i = 0, n = commands.length; i < n; i++) {
    const command = commands[i], response = raw[i];

    if (response.errors) {
      const detailedErrDescriptor = { errorDescriptors: response.errors, command, rawResponse: response };
      detailedErrDescriptors.push(detailedErrDescriptor);
    }
  }

  const instance = new err(detailedErrDescriptors) ;
  Object.assign(instance, attributes ?? {});
  return instance;
};
