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

import type { GuaranteedUpdateResult, GenericUpdateResult } from '@/src/documents/commands/types/update/update-common.js';
import type { RawDataAPIResponse} from '@/src/lib/index.js';
import { SerDesTarget } from '@/src/lib/index.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';

/**
 * @internal
 */
export const mkUpdateResult = <N extends number>(resp?: RawDataAPIResponse) => ({
  modifiedCount: (resp?.status?.modifiedCount ?? 0) as N,
  matchedCount: (resp?.status?.matchedCount ?? 0) as N,
});

/**
 * @internal
 */
export const coalesceUpsertIntoUpdateResult = <ID, N extends number>(serdes: SerDes, commonResult: GuaranteedUpdateResult<N>, resp: RawDataAPIResponse): GenericUpdateResult<ID, N> =>
  (resp.status?.upsertedId)
    ? {
      ...commonResult,
      upsertedId: serdes.deserialize(resp.status.upsertedId, resp, SerDesTarget.InsertedId),
      upsertedCount: 1,
    }
    : {
      ...commonResult,
      upsertedCount: 0,
    };
