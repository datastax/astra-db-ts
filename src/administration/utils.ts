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

import type { AstraDbAdminInfo, AstraDbRegionInfo } from '@/src/administration/types/admin/database-info.js';
import { buildAstraEndpoint } from '@/src/lib/utils.js';
import type { SomeDoc } from '@/src/documents/index.js';

/**
 * @internal
 */
export const extractAstraEnvironment = (endpoint: string) => {
  switch (true) {
    case endpoint.includes('apps.astra-dev.datastax.com'):
      return 'dev';
    case endpoint.includes('apps.astra-test.datastax.com'):
      return 'test';
    case endpoint.includes('apps.astra.datastax.com'):
      return 'prod';
    default:
      throw new Error(`Cannot extract astra environment for endpoint '${endpoint}'`);
  }
};

/**
 * @internal
 */
export const buildAstraDatabaseAdminInfo = (raw: SomeDoc, environment: 'dev' | 'prod' | 'test'): AstraDbAdminInfo => {
  const regions = raw.info.datacenters.map((dc: any): AstraDbRegionInfo => ({
    name: dc.region,
    apiEndpoint: buildAstraEndpoint(raw.id, dc.region, environment),
    createdAt: new Date(dc.dateCreated),
  }));

  return {
    id: raw.id,
    name: raw.info.name,
    orgId: raw.orgId,
    ownerId: raw.ownerId,
    keyspaces: /* c8 ignore next: can't reproduce, but just in case */ raw.info.keyspaces ?? [],
    environment: environment,
    cloudProvider: raw.info.cloudProvider!,
    createdAt: new Date(raw.creationTime),
    lastUsed: new Date(raw.lastUsageTime),
    status: raw.status,
    regions: regions,
    raw: raw,
  };
};
