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
      const tm = timeouts.single('generalMethodTimeoutMs', null);
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, Timeouts.Default.requestTimeoutMs);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeoutMs');
      assert.strictEqual(e.message, `Command timed out after ${Timeouts.Default.requestTimeoutMs}ms (requestTimeoutMs timed out)`);

      assert.deepStrictEqual(tm.initial(), {
        generalMethodTimeoutMs: Timeouts.Default.generalMethodTimeoutMs,
        requestTimeoutMs: Timeouts.Default.requestTimeoutMs,
      });
    });

    it('works w/ override number', () => {
      const tm = timeouts.single('generalMethodTimeoutMs', { timeout: 100 });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, 100);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'provided');
      assert.strictEqual(e.message, 'Command timed out after 100ms (The timeout provided via `{ timeout: <number> }` timed out)');

      assert.deepStrictEqual(tm.initial(), {
        generalMethodTimeoutMs: 100,
        requestTimeoutMs: 100,
      });
    });

    it('works w/ partial override object', () => {
      const tm = timeouts.single('databaseAdminTimeoutMs', { timeout: { generalMethodTimeoutMs: 100, databaseAdminTimeoutMs: 50 } });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, 50);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'databaseAdminTimeoutMs');
      assert.strictEqual(e.message, 'Command timed out after 50ms (databaseAdminTimeoutMs timed out)');

      assert.deepStrictEqual(tm.initial(), {
        requestTimeoutMs: Timeouts.Default.requestTimeoutMs,
        databaseAdminTimeoutMs: 50,
      });
    });

    it('works w/ full override object', () => {
      const tm = timeouts.single('databaseAdminTimeoutMs', { timeout: { generalMethodTimeoutMs: 100, requestTimeoutMs: 10, databaseAdminTimeoutMs: 50 } });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeoutMs');
      assert.strictEqual(e.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');

      assert.deepStrictEqual(tm.initial(), {
        databaseAdminTimeoutMs: 50,
        requestTimeoutMs: 10,
      });
    });

    it('works w/ uniform full override object', () => {
      const tm = timeouts.single('keyspaceAdminTimeoutMs', { timeout: { keyspaceAdminTimeoutMs: Timeouts.Default.requestTimeoutMs } });
      const [timeout, mkError] = tm.advance(info(tm));

      assert.strictEqual(timeout, Timeouts.Default.requestTimeoutMs);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs', 'keyspaceAdminTimeoutMs']);
      assert.strictEqual(e.message, `Command timed out after ${Timeouts.Default.requestTimeoutMs}ms (requestTimeoutMs and keyspaceAdminTimeoutMs simultaneously timed out)`);

      assert.deepStrictEqual(tm.initial(), {
        keyspaceAdminTimeoutMs: Timeouts.Default.requestTimeoutMs,
        requestTimeoutMs: Timeouts.Default.requestTimeoutMs,
      });
    });
  });

  parallel('multipart', () => {
    it('works w/ override number', async () => {
      const tm = timeouts.multipart('generalMethodTimeoutMs', { timeout: 10001 });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, Timeouts.Default.requestTimeoutMs);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeoutMs');
      assert.strictEqual(e.message, `Command timed out after ${Timeouts.Default.requestTimeoutMs}ms (requestTimeoutMs timed out)`);

      assert.deepStrictEqual(tm.initial(), {
        requestTimeoutMs: Timeouts.Default.requestTimeoutMs,
        generalMethodTimeoutMs: 10001,
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
      assert.strictEqual(e2.timeoutType, 'generalMethodTimeoutMs');
      assert.strictEqual(e2.message, 'Command timed out after 10001ms (generalMethodTimeoutMs timed out)');
    });

    it('works w/ partial override object', async () => {
      const tm = timeouts.multipart('tableAdminTimeoutMs', { timeout: { requestTimeoutMs: 10 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeoutMs');
      assert.strictEqual(e.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');

      assert.deepStrictEqual(tm.initial(), {
        tableAdminTimeoutMs: Timeouts.Default.tableAdminTimeoutMs,
        requestTimeoutMs: 10,
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
      assert.strictEqual(e2.timeoutType, 'requestTimeoutMs');
      assert.strictEqual(e2.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');
    });

    it('works w/ full override object', async () => {
      const tm = timeouts.multipart('tableAdminTimeoutMs', { timeout: { requestTimeoutMs: 10, tableAdminTimeoutMs: 100 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.strictEqual(e.timeoutType, 'requestTimeoutMs');
      assert.strictEqual(e.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');

      assert.deepStrictEqual(tm.initial(), {
        tableAdminTimeoutMs: 100,
        requestTimeoutMs: 10,
      });

      await new Promise(resolve => setTimeout(resolve, 5));
      [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.strictEqual(e2.timeoutType, 'requestTimeoutMs');
      assert.strictEqual(e2.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');

      await new Promise(resolve => setTimeout(resolve, 100));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e3 = mkError();
      assert.ok(e3 instanceof TimeoutError);
      assert.deepStrictEqual(e3.info, info(tm));
      assert.strictEqual(e3.timeoutType, 'tableAdminTimeoutMs');
      assert.strictEqual(e3.message, 'Command timed out after 100ms (tableAdminTimeoutMs timed out)');
    });

    it('works w/ uniform full override object', async () => {
      const tm = timeouts.multipart('keyspaceAdminTimeoutMs', { timeout: { requestTimeoutMs: 100, keyspaceAdminTimeoutMs: 100 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 100);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs', 'keyspaceAdminTimeoutMs']);
      assert.strictEqual(e.message, 'Command timed out after 100ms (requestTimeoutMs and keyspaceAdminTimeoutMs simultaneously timed out)');

      assert.deepStrictEqual(tm.initial(), {
        keyspaceAdminTimeoutMs: 100,
        requestTimeoutMs: 100,
      });

      await new Promise(resolve => setTimeout(resolve, 51));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 50);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.strictEqual(e2.timeoutType, 'keyspaceAdminTimeoutMs');
      assert.strictEqual(e2.message, 'Command timed out after 100ms (keyspaceAdminTimeoutMs timed out)');

      await new Promise(resolve => setTimeout(resolve, 51));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e3 = mkError();
      assert.ok(e3 instanceof TimeoutError);
      assert.deepStrictEqual(e3.info, info(tm));
      assert.strictEqual(e3.timeoutType, 'keyspaceAdminTimeoutMs');
      assert.strictEqual(e3.message, 'Command timed out after 100ms (keyspaceAdminTimeoutMs timed out)');
    });
  });
});
