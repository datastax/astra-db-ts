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
import { describe, it, parallel } from '@/tests/testlib';
import { TimedOutTypes, TimeoutManager, Timeouts } from '@/src/lib/api/timeouts';
import { HTTPRequestInfo } from '@/src/lib/api/clients';

describe('unit.lib.api.timeouts', () => {
  class TimeoutError extends Error {
    constructor(public readonly info: HTTPRequestInfo, public readonly timeoutType: TimedOutTypes) {
      super(Timeouts.fmtTimeoutMsg(info.timeoutManager, timeoutType));
    }
  }

  const timeouts = new Timeouts((info, timeoutType) => new TimeoutError(info, timeoutType), Timeouts.Default);
  const info = (timeoutManager: TimeoutManager) => ({ timeoutManager }) as HTTPRequestInfo;

  describe('single', () => {
    it('works w/ no override', () => {
      const tm = timeouts.single('generalMethodTimeout', null);
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, Timeouts.Default.requestTimeout);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeout');
      assert.strictEqual(e.message, `Command timed out after ${Timeouts.Default.requestTimeout}ms (requestTimeout timed out)`);

      assert.deepStrictEqual(tm.initial(), {
        generalMethodTimeout: Timeouts.Default.generalMethodTimeout,
        requestTimeout: Timeouts.Default.requestTimeout,
      });
    });

    it('works w/ override number', () => {
      const tm = timeouts.single('generalMethodTimeout', { timeout: 100 });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, 100);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'provided');
      assert.strictEqual(e.message, 'Command timed out after 100ms (The timeout provided via `{ timeout: 100 }` timed out)');

      assert.deepStrictEqual(tm.initial(), {
        generalMethodTimeout: 100,
        requestTimeout: 100,
      });
    });

    it('works w/ partial override object', () => {
      const tm = timeouts.single('databaseAdminTimeout', { timeout: { generalMethodTimeout: 100, databaseAdminTimeout: 50 } });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, 50);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'databaseAdminTimeout');
      assert.strictEqual(e.message, 'Command timed out after 50ms (databaseAdminTimeout timed out)');

      assert.deepStrictEqual(tm.initial(), {
        requestTimeout: Timeouts.Default.requestTimeout,
        databaseAdminTimeout: 50,
      });
    });

    it('works w/ full override object', () => {
      const tm = timeouts.single('databaseAdminTimeout', { timeout: { generalMethodTimeout: 100, requestTimeout: 10, databaseAdminTimeout: 50 } });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeout');
      assert.strictEqual(e.message, 'Command timed out after 10ms (requestTimeout timed out)');

      assert.deepStrictEqual(tm.initial(), {
        databaseAdminTimeout: 50,
        requestTimeout: 10,
      });
    });

    it('works w/ uniform full override object', () => {
      const tm = timeouts.single('keyspaceAdminTimeout', { timeout: { keyspaceAdminTimeout: Timeouts.Default.requestTimeout } });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, Timeouts.Default.requestTimeout);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeout', 'keyspaceAdminTimeout']);
      assert.strictEqual(e.message, `Command timed out after ${Timeouts.Default.requestTimeout}ms (requestTimeout and keyspaceAdminTimeout simultaneously timed out)`);

      assert.deepStrictEqual(tm.initial(), {
        keyspaceAdminTimeout: Timeouts.Default.requestTimeout,
        requestTimeout: Timeouts.Default.requestTimeout,
      });
    });
  });

  parallel('multipart', () => {
    it('works w/ override number', async () => {
      const tm = timeouts.multipart('generalMethodTimeout', { timeout: 10001 });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, Timeouts.Default.requestTimeout);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeout');
      assert.strictEqual(e.message, `Command timed out after ${Timeouts.Default.requestTimeout}ms (requestTimeout timed out)`);

      assert.deepStrictEqual(tm.initial(), {
        requestTimeout: Timeouts.Default.requestTimeout,
        generalMethodTimeout: 10001,
      });

      await new Promise(resolve => setTimeout(resolve, 5001));
      [timeout] = tm.advance(info(tm));
      assert.ok(timeout <= 5000.5);

      await new Promise(resolve => setTimeout(resolve, 5001));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.strictEqual(e2.timeoutType, 'generalMethodTimeout');
      assert.strictEqual(e2.message, 'Command timed out after 10001ms (generalMethodTimeout timed out)');
    });

    it('works w/ partial override object', async () => {
      const tm = timeouts.multipart('tableAdminTimeout', { timeout: { requestTimeout: 10 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeout');
      assert.strictEqual(e.message, 'Command timed out after 10ms (requestTimeout timed out)');

      assert.deepStrictEqual(tm.initial(), {
        tableAdminTimeout: Timeouts.Default.tableAdminTimeout,
        requestTimeout: 10,
      });

      await new Promise(resolve => setTimeout(resolve, 5));
      [timeout] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      await new Promise(resolve => setTimeout(resolve, 1000));
      [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.strictEqual(e2.timeoutType, 'requestTimeout');
      assert.strictEqual(e2.message, 'Command timed out after 10ms (requestTimeout timed out)');
    });

    it('works w/ full override object', async () => {
      const tm = timeouts.multipart('tableAdminTimeout', { timeout: { requestTimeout: 10, tableAdminTimeout: 100 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeout');
      assert.strictEqual(e.message, 'Command timed out after 10ms (requestTimeout timed out)');

      assert.deepStrictEqual(tm.initial(), {
        tableAdminTimeout: 100,
        requestTimeout: 10,
      });

      await new Promise(resolve => setTimeout(resolve, 5));
      [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.strictEqual(e2.timeoutType, 'requestTimeout');
      assert.strictEqual(e2.message, 'Command timed out after 10ms (requestTimeout timed out)');

      await new Promise(resolve => setTimeout(resolve, 100));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e3 = mkError();
      assert.ok(e3 instanceof TimeoutError);
      assert.deepStrictEqual(e3.info, info(tm));
      assert.strictEqual(e3.timeoutType, 'tableAdminTimeout');
      assert.strictEqual(e3.message, 'Command timed out after 100ms (tableAdminTimeout timed out)');
    });

    it('works w/ uniform full override object', async () => {
      const tm = timeouts.multipart('keyspaceAdminTimeout', { timeout: { requestTimeout: 100, keyspaceAdminTimeout: 100 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 100);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeout', 'keyspaceAdminTimeout']);
      assert.strictEqual(e.message, 'Command timed out after 100ms (requestTimeout and keyspaceAdminTimeout simultaneously timed out)');

      assert.deepStrictEqual(tm.initial(), {
        keyspaceAdminTimeout: 100,
        requestTimeout: 100,
      });

      await new Promise(resolve => setTimeout(resolve, 51));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 50);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.strictEqual(e2.timeoutType, 'keyspaceAdminTimeout');
      assert.strictEqual(e2.message, 'Command timed out after 100ms (keyspaceAdminTimeout timed out)');

      await new Promise(resolve => setTimeout(resolve, 51));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e3 = mkError();
      assert.ok(e3 instanceof TimeoutError);
      assert.deepStrictEqual(e3.info, info(tm));
      assert.strictEqual(e3.timeoutType, 'keyspaceAdminTimeout');
      assert.strictEqual(e3.message, 'Command timed out after 100ms (keyspaceAdminTimeout timed out)');
    });
  });
});
