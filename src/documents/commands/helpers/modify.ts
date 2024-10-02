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

import { SomeDoc } from '@/src/documents';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { nullish } from '@/src/lib';

export const runFindOneAnd = async (httpClient: DataAPIHttpClient, command: SomeDoc, options: SomeDoc | nullish) => {
  const resp = await httpClient.executeCommand(command, options);
  const document = resp.data?.document || null;

  return (options?.includeResultMetadata)
    ? {
      value: document,
      ok: 1,
    }
    : document;
};
