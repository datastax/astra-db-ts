import { GuaranteedUpdateOptions, GenericUpdateResult } from '@/src/documents/commands/types/update/update-common';
import { RawDataAPIResponse } from '@/src/lib';

export const mkUpdateResult = <N extends number>(resp?: RawDataAPIResponse) => ({
  modifiedCount: resp?.status?.modifiedCount ?? 0 as N,
  matchedCount: resp?.status?.matchedCount ?? 0 as N,
});

export const coalesceUpsertIntoUpdateResult = <ID, N extends number>(commonResult: GuaranteedUpdateOptions<N>, resp: RawDataAPIResponse): GenericUpdateResult<ID, N> =>
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
