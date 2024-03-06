import { InsertManyResult } from '@/src/client';

export type InsertManyBulkOptions =
  ({
    parallel?: number;
    ordered?: never;
  } | {
    ordered?: boolean;
    parallel?: 1;
  })

export interface InsertManyBulkResult<Schema> extends InsertManyResult {
  failedCount: number;
  failedInserts: FailedInsert<Schema>[];
}

export interface FailedInsert<Schema> {
  document: Schema;
  errors?: any[];
}
