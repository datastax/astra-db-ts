import { InsertManyResult } from '@/src/client';

export type InsertManyBulkOptions =
  | {
    chunkSize?: number;
    parallel?: number;
    ordered?: never;
  } | {
    ordered?: boolean;
    chunkSize?: number;
    parallel?: never;
  }

export interface InsertManyBulkResult<Schema> extends InsertManyResult {
  failedCount: number;
  failedInserts: FailedInsert<Schema>[];
}

export interface FailedInsert<Schema> {
  document: Schema;
  error?: any;
}
