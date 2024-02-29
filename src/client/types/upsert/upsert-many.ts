export interface UpsertManyOptions {
  insertionChunkSize?: number;
  insertionParallel?: number;
  upsertParallel?: number;
}

export interface UpsertManyResult<Schema> {
  acknowledged: true;
  insertedIds: string[];
  insertedCount: number;
  modifiedIds: string[];
  modifiedCount: number;
  failedCount: number;
  failedUpserts: FailedUpsert<Schema>[];
}

export interface FailedUpsert<Schema> {
  document: Schema;
  error?: any;
}
