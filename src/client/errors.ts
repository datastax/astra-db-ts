import { InsertManyResult } from '@/src/client/types/insert/insert-many';
import { DeleteManyResult } from '@/src/client/types/delete/delete-many';
import { UpdateManyResult } from '@/src/client/types/update/update-many';
import { BulkWriteResult } from '@/src/client/types/misc/bulk-write';

export interface DataAPIErrorDescriptor {
  readonly errorCode?: string,
  readonly message?: string,
  readonly attributes?: Record<string, any>,
}

export interface DataAPIDetailedErrorDescriptor {
  readonly errorDescriptors: DataAPIErrorDescriptor[],
  readonly command: Record<string, any>,
  readonly raw: Record<string, any>,
}

export abstract class DataAPIError extends Error {}

export class DataAPITimeout extends DataAPIError {
  constructor(readonly command: Record<string, any>, readonly timeout: number) {
    super(`Command timed out after ${timeout}ms`);
    this.name = "DataAPITimeout";
  }
}

export class TooManyDocsToCountError extends DataAPIError {
  name = 'TooManyDocsToCountError'

  constructor(readonly limit: number, readonly hitServerLimit: boolean) {
    const message = (hitServerLimit)
      ? `Too many documents to count (server limit of ${limit} reached)`
      : `Too many documents to count (provided limit is ${limit})`;
    super(message);
  }
}

export class CursorAlreadyInitializedError extends DataAPIError {
  constructor(message: string) {
    super(message);
    this.name = 'CursorAlreadyInitializedError';
  }
}

export class DataAPIResponseError extends DataAPIError {
  name = 'DataAPIResponseError'

  constructor(
    public readonly message: string,
    public readonly errorDescriptors: DataAPIErrorDescriptor[],
    public readonly detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[],
  ) { super(message) }
}

export abstract class CumulativeDataAPIError extends DataAPIResponseError {
  public readonly partialResult!: unknown;
}

export class InsertManyError<Schema> extends CumulativeDataAPIError {
  name = 'InsertManyError';
  public readonly partialResult!: InsertManyResult<Schema>;
}

export class DeleteManyError extends CumulativeDataAPIError {
  name = 'DeleteManyError';
  public readonly partialResult!: DeleteManyResult;
}

export class UpdateManyError extends CumulativeDataAPIError {
  name = 'UpdateManyError';
  public readonly partialResult!: UpdateManyResult;
}

export class BulkWriteError extends CumulativeDataAPIError {
  name = 'BulkWriteError';
  public readonly partialResult!: BulkWriteResult;
}

/** @internal */
type InferPartialResult<T> = T extends { readonly partialResult: infer P } ? P : never;

/** @internal */
export const mkRespErrorFromResponse = <E extends DataAPIResponseError>(err: new (message: string, errorDescriptors: DataAPIErrorDescriptor[], detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[]) => E, command: Record<string, any>, raw: Record<string, any>, partialResult?: InferPartialResult<E>) => {
  return mkRespErrorFromResponses(err, [command], [raw], partialResult);
}

/** @internal */
export const mkRespErrorFromResponses = <E extends DataAPIResponseError>(err: new (message: string, errorDescriptors: DataAPIErrorDescriptor[], detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[]) => E, commands: Record<string, any>[], raw: Record<string, any>[], partialResult?: InferPartialResult<E>) => {
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

      const detailedDescriptor = { errorDescriptors: descriptors, command, raw: response };
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
