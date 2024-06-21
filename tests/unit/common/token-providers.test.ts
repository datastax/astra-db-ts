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

import assert from 'assert';
import { UsernamePasswordTokenProvider, StaticTokenProvider } from '@/src/common';

describe('unit.common.token-providers', () => {
  const anyGlobalThis = globalThis as any;

  describe('StaticTokenProvider', () => {
    it('should provide the token it was given', async () => {
      const tp = new StaticTokenProvider('token');
      assert.strictEqual(await tp.getToken(), 'token');
    });
  });

  describe('UsernamePasswordTokenProvider', () => {
    it('should provide the properly encoded cassandra token in node', async () => {
      const tp = new UsernamePasswordTokenProvider('username', 'password');
      assert.strictEqual(await tp.getToken(), 'Cassandra:dXNlcm5hbWU=:cGFzc3dvcmQ=');
    });

    it('should provide the properly encoded cassandra token in the browser', async () => {
      const [window, buffer] = [anyGlobalThis.window, anyGlobalThis.Buffer];

      anyGlobalThis.window = { btoa: anyGlobalThis.btoa };
      anyGlobalThis.Buffer = null!;
      const tp = new UsernamePasswordTokenProvider('username', 'password');
      assert.strictEqual(await tp.getToken(), 'Cassandra:dXNlcm5hbWU=:cGFzc3dvcmQ=');

      [anyGlobalThis.window, anyGlobalThis.Buffer] = [window, buffer];
    });

    it('should throw an error if invalid environment', () => {
      const buffer = globalThis.Buffer;

      anyGlobalThis.Buffer = null!;
      assert.throws(() => new UsernamePasswordTokenProvider('username', 'password'));

      anyGlobalThis.Buffer = buffer;
    });
  });
});
