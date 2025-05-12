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
// noinspection DuplicatedCode

import { describe, it } from '@/tests/testlib/index.js';
import type { AstraAvailableRegionInfo } from '@/src/index.js';
import { DataAPIClient, DevOpsAPIResponseError } from '@/src/index.js';
import assert from 'assert';

describe('(ASTRA) integration.administration.astra-admin', ({ admin }) => {
  it('should not stop you from creating an AstraAdmin without a token', async () => {
    const client = new DataAPIClient();
    const admin = client.admin();
    await assert.rejects(() => admin.listDatabases(), DevOpsAPIResponseError);
  });

  describe('findAvailableRegions', () => {
    it('should work', async () => {
      const verifyStructure = (region: AstraAvailableRegionInfo) => {
        assert.ok(region);
        assert.ok(['standard', 'premium', 'premium_plus'].includes(region.classification));
        assert.ok(['AWS', 'GCP', 'AZURE'].includes(region.cloudProvider));
        assert.ok(typeof region.displayName as unknown === 'string');
        assert.ok(typeof region.enabled as unknown === 'boolean');
        assert.ok(typeof region.name as unknown === 'string');
        assert.ok(typeof region.reservedForQualifiedUsers as unknown === 'boolean');
        assert.ok(['na', 'apac', 'emea', 'sa'].includes(region.zone));
      };

      const regions = await admin.findAvailableRegions();
      assert.ok(regions.length);
      regions.forEach(verifyStructure);

      const allRegions = await admin.findAvailableRegions({ onlyOrgEnabledRegions: false });
      assert.ok(allRegions.length);
      allRegions.forEach(verifyStructure);

      assert.ok(regions.length < allRegions.length);
    });
  });
});
