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

import type { InsertManyResult } from '@/src/data-api/types/insert/insert-many';
import type { DeleteManyResult } from '@/src/data-api/types/delete/delete-many';
import type { UpdateManyResult } from '@/src/data-api/types/update/update-many';
import type { BulkWriteResult } from '@/src/data-api/types/misc/bulk-write';
import type { CuratedAPIResponse, RawDataAPIResponse, FetcherResponseInfo } from '@/src/api';
import { SomeDoc } from '@/src/data-api/types/document';

/**
 * An object representing a single "soft" (2XX) error returned from the Data API, typically with an error code and a
 * human-readable message. An API request may return with an HTTP 200 success error code, but contain a nonzero
 * amount of these, such as for duplicate inserts, or invalid IDs.
 *
 * This is *not* used for "hard" (4XX, 5XX) errors, which are rarer and would be thrown directly by the underlying
 * code.
 *
 * @example
 * ```typescript
 * {
 *   errorCode: 'DOCUMENT_ALREADY_EXISTS',
 *   message: "Failed to insert document with _id 'id3': Document already exists with the given _id",
 *   attributes: {},
 * }
 * ```
 *
 * @field errorCode - A string code representing the exact error
 * @field message - A human-readable message describing the error
 * @field attributes - A map of additional attributes returned by the API. Often empty
 *
 * @public
 */
export interface DataAPIErrorDescriptor {
  /**
   * A string code representing the exact error
   */
  readonly errorCode?: string,
  /**
   * A human-readable message describing the error
   */
  readonly message?: string,
  /**
   * A map of additional attributes that may be useful for debugging or logging returned by the API. Not guaranteed to
   * be non-empty. Probably more often empty than not.
   */
  readonly attributes?: Record<string, any>,
}

/**
 * An object representing a *complete* error response from the Data API, including the original command that was sent,
 * and the raw API response from the server.
 *
 * This is *not* used for "hard" (4XX, 5XX) errors, which are rarer and would be thrown directly by the underlying
 * code.
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
  readonly errorDescriptors: DataAPIErrorDescriptor[],
  /**
   * The original command that was sent to the API, as a plain object. This is the *raw* command, not necessarily in
   * the exact format the client may use, even with `bulkWrite`.
   *
   * @example
   * ```typescript
   * {
   *   insertOne: {
   *     document: { _id: 'docml10', name: 'Document 10' },
   *   }
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
   *   data: undefined,
   *   errors: [
   *     {
   *       message: "Failed to insert document with _id 'id3': Document already exists with the given _id",
   *       errorCode: 'DOCUMENT_ALREADY_EXISTS'
   *     }
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
 * This is *only* for Data API related errors, such as a non-existent collection, or a duplicate key error. It
 * is *not*, however, for errors such as an HTTP network error, or a malformed request. The exception being timeouts,
 * which are represented by the {@link DataAPITimeoutError} class.
 *
 * @public
 */
export abstract class DataAPIError extends Error {}

/**
 * An error thrown on non-2XX status codes from the Data API, such as 4XX or 5XX errors.
 */
export class DataAPIHttpError extends DataAPIError {
  /**
   * The error descriptors returned by the API to describe what went wrong.
   */
  public readonly status: number;

  /**
   * The HTTP status code of the response, if available.
   */
  public readonly body: string;

  /**
   * The "raw", errored response from the API.
   */
  public readonly raw: CuratedAPIResponse;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(resp: FetcherResponseInfo) {
    super(`HTTP error: ${resp.status}${resp.body ? `; ${resp.body}` : ''}`);
    this.status = resp.status;
    this.body = resp.body!;
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
  public readonly timeout: number;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(timeout: number) {
    super(`Command timed out after ${timeout}ms`);
    this.timeout = timeout;
    this.name = 'DataAPITimeoutError';
  }
}

/**
 * Caused by a `countDocuments` operation that failed because the resulting number of documents exceeded *either*
 * the upper bound set by the caller, or the hard limit imposed by the Data API.
 *
 * @example
 * ```typescript
 * await collection.insertMany('<100_length_array>');
 *
 * try {
 *   await collection.countDocuments({}, 50);
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
 * Caused by trying to perform an operation on an already-initialized {@link FindCursor} that requires it to be
 * uninitialized.
 *
 * If you run into this error, and you really do need to change an option on the cursor, you can rewind the cursor
 * using {@link FindCursor.rewind}, or clone it using {@link FindCursor.clone}.
 *
 * @example
 * ```typescript
 * await collection.find({}).toArray();
 *
 * try {
 *   await cursor.limit(10);
 * } catch (e) {
 *   if (e instanceof CursorAlreadyInitializedError) {
 *     console.log(e.message); // "Cursor is already initialized..."
 *   }
 * }
 * ```
 *
 * @public
 */
export class CursorIsStartedError extends DataAPIError {
  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(message: string) {
    super(message);
    this.name = 'CursorAlreadyInitializedError';
  }
}

/**
 * An exception thrown when certain operations are attempted on a collection that does not exist.
 *
 * @field namespace - The namespace that the collection was not found in
 * @field collectionName - The name of the collection that was not found
 *
 * @public
 */
export class CollectionNotFoundError extends DataAPIError {
  /**
   * The namespace where the collection already exists
   */
  public readonly namespace: string;

  /**
   * The name of the collection that already exists
   */
  public readonly collectionName: string;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(namespace: string, collectionName: string) {
    super(`Collection '${namespace}.${collectionName}' not found`);
    this.namespace = namespace;
    this.collectionName = collectionName;
    this.name = 'CollectionNotFoundError';
  }
}

/**
 * An exception thrown when an operation that expects a collection not to exist is attempted on a collection that
 * already exists.
 *
 * @field namespace - The namespace where the collection already exists
 * @field collectionName - The name of the collection that already exists
 *
 * @public
 */
export class CollectionAlreadyExistsError extends DataAPIError {
  /**
   * The namespace where the collection already exists
   */
  public readonly namespace: string;

  /**
   * The name of the collection that already exists
   */
  public readonly collectionName: string;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(namespace: string, collectionName: string) {
    super(`Collection '${namespace}.${collectionName}' already exists`);
    this.namespace = namespace;
    this.collectionName = collectionName;
    this.name = 'CollectionAlreadyExistsError';
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
  constructor(message: string, errorDescriptors: DataAPIErrorDescriptor[], detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[]) {
    super(message);
    this.message = message;
    this.errorDescriptors = errorDescriptors;
    this.detailedErrorDescriptors = detailedErrorDescriptors;
    this.name = 'DataAPIResponseError';
  }
}

/**
 * An abstract class representing an exception that occurred due to a *cumulative* operation on the Data API. This is
 * the base class for all Data API errors that represent a paginated operation, such as `insertMany`, `deleteMany`,
 * `updateMany`, and `bulkWrite`, and will never be thrown directly.
 *
 * Useful for `instanceof` checks.
 *
 * This is *only* for Data API related errors, such as a non-existent collection, or a duplicate key error. It
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
export abstract class CumulativeDataAPIError extends DataAPIResponseError {
  /**
   * The partial result of the operation that was performed. This is *always* defined, and is
   * the result of the operation up to the point of the first error. For example, if you're inserting 100 documents
   * ordered and the 50th document fails, the `partialResult` will contain the first 49 documents that were
   * successfully inserted.
   */
  public readonly partialResult!: unknown;
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
export class InsertManyError extends CumulativeDataAPIError {
  /**
   * The name of the error. This is always 'InsertManyError'.
   */
  name = 'InsertManyError';

  /**
   * The partial result of the `InsertMany` operation that was performed. This is *always* defined, and is the result
   * of all successful insertions.
   */
  declare public readonly partialResult: InsertManyResult<SomeDoc>;
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
export class DeleteManyError extends CumulativeDataAPIError {
  /**
   * The name of the error. This is always 'DeleteManyError'.
   */
  name = 'DeleteManyError';

  /**
   * The partial result of the `DeleteMany` operation that was performed. This is *always* defined, and is the result
   * of the operation up to the point of the first error.
   */
  declare public readonly partialResult: DeleteManyResult;
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
export class UpdateManyError extends CumulativeDataAPIError {
  /**
   * The name of the error. This is always 'UpdateManyError'.
   */
  name = 'UpdateManyError';

  /**
   * The partial result of the `UpdateMany` operation that was performed. This is *always* defined, and is the result
   * of the operation up to the point of the first error.
   */
  declare public readonly partialResult: UpdateManyResult<SomeDoc>;
}

/**
 * Represents an error that occurred during a `bulkWrite` operation (which is, generally, paginated).
 *
 * Contains the number of documents that were successfully inserted, updated, deleted, etc., as well as the cumulative
 * errors that occurred during the operation.
 *
 * If the operation was ordered, the results will be in the same order as the operations that were attempted to be
 * performed.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `BulkWrite` operation that was performed
 *
 * @public
 */
export class BulkWriteError extends CumulativeDataAPIError {
  /**
   * The name of the error. This is always 'BulkWriteError'.
   */
  name = 'BulkWriteError';

  /**
   * The partial result of the `BulkWrite` operation that was performed. This is *always* defined, and is the result
   * of all successful operations.
   */
  declare public readonly partialResult: BulkWriteResult<SomeDoc>;
}

type InferPartialResult<T> = T extends { readonly partialResult: infer P } ? P : never;

/**
 * @internal
 */
export const mkRespErrorFromResponse = <E extends DataAPIResponseError>(err: new (message: string, errorDescriptors: DataAPIErrorDescriptor[], detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[]) => E, command: Record<string, any>, raw: RawDataAPIResponse, partialResult?: InferPartialResult<E>) => {
  return mkRespErrorFromResponses(err, [command], [raw], partialResult);
}

/**
 * @internal
 */
export const mkRespErrorFromResponses = <E extends DataAPIResponseError>(err: new (message: string, errorDescriptors: DataAPIErrorDescriptor[], detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[]) => E, commands: Record<string, any>[], raw: RawDataAPIResponse[], partialResult?: InferPartialResult<E>) => {
  const detailedDescriptors = [] as DataAPIDetailedErrorDescriptor[];

  for (let i = 0, n = commands.length; i < n; i++) {
    const command = commands[i], response = raw[i];

    if (response.errors) {
      const descriptors = response.errors.map((error: any) => {
        const attributes = { ...error };
        delete attributes.message;
        delete attributes.errorCode;
        return { errorCode: error.errorCode, message: error.message, attributes };
      }) as DataAPIErrorDescriptor[];

      const detailedDescriptor = { errorDescriptors: descriptors, command, rawResponse: response };
      detailedDescriptors.push(detailedDescriptor);
    }
  }

  const errorDescriptors = detailedDescriptors.flatMap(d => d.errorDescriptors);

  const message = errorDescriptors[0]?.message || 'Something unexpected occurred';

  const instance = new err(message, errorDescriptors, detailedDescriptors) ;

  if (partialResult) {
    // @ts-expect-error - If the lord wants a partialResult, the lord will get a partialResult.
    instance.partialResult = partialResult;
  }
  return instance;
}
