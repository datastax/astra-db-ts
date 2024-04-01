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

import { initTestObjects } from '@/tests/fixtures';
import { DevopsApiHttpClient, HTTP_METHODS } from '@/src/api';
import assert from 'assert';
import { DevopsApiTimeout } from '@/src/devops';

describe('integration.api.devops-http-client', () => {
  let httpClient: DevopsApiHttpClient;

  before(async function () {
    const [, db] = await initTestObjects(this);
    httpClient = db.admin()['_httpClient'];
  });

  describe('request tests', () => {
    it('should timeout properly', async () => {
      await assert.rejects(async () => {
        await httpClient.request({
          method: HTTP_METHODS.Get,
          path: '/databases',
        }, { maxTimeMS: 1 });
      }, DevopsApiTimeout);
    });
  });
});
