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

import { DataApiClient } from '@/src/client';
import * as process from 'process';
import assert from 'assert';

describe('integration.client.data-api-client', () => {
  describe('db tests', () => {
    it('properly connects to a db by endpoint', async () => {
      const db = new DataApiClient(process.env.APPLICATION_TOKEN!).db(process.env.ASTRA_URI!);
      const collections = await db.listCollections();
      assert.ok(Array.isArray(collections));
    });

    it('properly connects to a db by id and region', async () => {
      const idAndRegion = process.env.ASTRA_URI!.split('.')[0].split('https://')[1].split('-');
      const id = idAndRegion.slice(0, 5).join('-');
      const region = idAndRegion.slice(5).join('-');
      const db = new DataApiClient(process.env.APPLICATION_TOKEN!).db(id, region);
      const collections = await db.listCollections();
      assert.ok(Array.isArray(collections));
    });
  });
});
