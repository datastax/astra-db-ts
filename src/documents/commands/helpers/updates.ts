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

import { GuaranteedUpdateResult, GenericUpdateResult } from '@/src/documents/commands/types/update/update-common';
import { RawDataAPIResponse } from '@/src/lib';

export const mkUpdateResult = <N extends number>(resp?: RawDataAPIResponse) => ({
  modifiedCount: resp?.status?.modifiedCount ?? 0 as N,
  matchedCount: resp?.status?.matchedCount ?? 0 as N,
});

export const coalesceUpsertIntoUpdateResult = <ID, N extends number>(commonResult: GuaranteedUpdateResult<N>, resp: RawDataAPIResponse): GenericUpdateResult<ID, N> =>
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
