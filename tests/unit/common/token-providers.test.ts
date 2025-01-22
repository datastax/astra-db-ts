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

import { StaticTokenProvider, UsernamePasswordTokenProvider } from '@/src/lib';
import { describe, it } from '@/tests/testlib';
import assert from 'assert';

describe('unit.common.token-providers', () => {
  describe('StaticTokenProvider', () => {
    it('should provide the token it was given', () => {
      const tp = new StaticTokenProvider('token');
      assert.strictEqual(tp.getToken(), 'token');
    });
  });

  describe('UsernamePasswordTokenProvider', () => {
    it('should provide the properly encoded cassandra token on the server', () => {
      const tp = new UsernamePasswordTokenProvider('username', 'password');
      assert.strictEqual(tp.getToken(), 'Cassandra:dXNlcm5hbWU=:cGFzc3dvcmQ=');
    });

    it('should provide the properly encoded cassandra token in the browser', { pretendEnv: 'browser' }, () => {
      const tp = new UsernamePasswordTokenProvider('username', 'password');
      assert.strictEqual(tp.getToken(), 'Cassandra:dXNlcm5hbWU=:cGFzc3dvcmQ=');
    });

    it('should error in unknown environment', { pretendEnv: 'unknown' }, () => {
      assert.throws(() => new UsernamePasswordTokenProvider('username', 'password'), { message: 'Unable to encode username/password to base64... please provide the "Cassandra:[username_b64]:[password_b64]" token manually' });
    });
  });
});
