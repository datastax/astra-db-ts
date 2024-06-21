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

import { assertTestsEnabled, ENVIRONMENT, initTestObjects } from '@/tests/fixtures';
import { Db } from '@/src/data-api';
import assert from 'assert';

describe('integration.devops.db-admin', () => {
  let db: Db;

  before(async function () {
    [, db] = await initTestObjects(this);
  });

  it('[long] [not-dev] works', async function () {
    assertTestsEnabled(this, 'LONG', 'NOT-DEV');

    const dbAdmin = (ENVIRONMENT === 'astra')
      ? db.admin({ environment: ENVIRONMENT })
      : db.admin({ environment: ENVIRONMENT });

    const namespaces1 = await dbAdmin.listNamespaces();
    assert.ok(!namespaces1.includes('slania'));

    await dbAdmin.createNamespace('slania');

    const namespaces2 = await dbAdmin.listNamespaces();
    assert.ok(namespaces2.includes('slania'));

    await dbAdmin.dropNamespace('slania');

    const namespaces3 = await dbAdmin.listNamespaces();
    assert.ok(!namespaces3.includes('slania'));
  }).timeout(100000);
});
