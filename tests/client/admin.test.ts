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

import { testClient } from '@/tests/fixtures';
import { Admin, Client, Db } from '@/src/client';

describe('Admin test', () => {
  let astraClient: Client | null;
  let db: Db;
  let _admin: Admin;

  before(async function() {
    if (testClient == null) {
      return this.skip();
    }

    astraClient = await testClient.new();

    if (astraClient === null) {
      return this.skip();
    }

    db = astraClient.db();
    _admin = db.admin();
  });
});
