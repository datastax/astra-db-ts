import { InternalUpdateResult } from '@/src/client/types/update/update-common';
import { BaseOptions } from '@/src/client/types/common';

/**
 * Represents the options for the `replaceOne` command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 */
export interface ReplaceOneOptions extends BaseOptions {
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   * @default false
   */
  upsert?: boolean,
}

export type ReplaceOneResult = InternalUpdateResult<0 | 1>;
