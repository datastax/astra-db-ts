import { GuaranteedUpdateOptions, InternalUpdateResult } from '@/src/documents/commands/types/update/update-common';
import { RawDataAPIResponse } from '@/src/lib';

export const mkCommonUpdateResult = <N extends number>() => ({
  modifiedCount: 0 as N,
  matchedCount: 0 as N,
});

export const coalesceUpsertIntoUpdateResult = <ID, N extends number>(commonResult: GuaranteedUpdateOptions<N>, resp: RawDataAPIResponse): InternalUpdateResult<ID, N> =>
  (resp.status?.upsertedId)
    ? {
      ...commonResult,
      upsertedId: resp.status.upsertedId,
      upsertedCount: 1,
    }
    : {
      ...commonResult,
      upsertedCount: 0,
    };
