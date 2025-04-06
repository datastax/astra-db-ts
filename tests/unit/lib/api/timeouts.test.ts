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
import { describe, it, parallel } from '@/tests/testlib/index.js';
import type { TimedOutCategories, TimeoutManager} from '@/src/lib/api/timeouts/timeouts.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { HttpClient, HTTPRequestInfo } from '@/src/lib/api/clients/index.js';

describe('unit.lib.api.timeouts', () => {
  class TimeoutError extends Error {
    constructor(public readonly info: HTTPRequestInfo, public readonly timeoutType: TimedOutCategories) {
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
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs']);
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
      assert.deepStrictEqual(e.timeoutType, 'provided');
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
      assert.deepStrictEqual(e.timeoutType, ['databaseAdminTimeoutMs']);
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
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs']);
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
    it('(LONG) works w/ override number', async () => {
      const tm = timeouts.multipart('generalMethodTimeoutMs', { timeout: 10001 });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, Timeouts.Default.requestTimeoutMs);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs']);
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
      assert.deepStrictEqual(e2.timeoutType, ['generalMethodTimeoutMs']);
      assert.strictEqual(e2.message, 'Command timed out after 10001ms (generalMethodTimeoutMs timed out)');
    });

    it('(LONG) works w/ partial override object', async () => {
      const tm = timeouts.multipart('tableAdminTimeoutMs', { timeout: { requestTimeoutMs: 10 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs']);
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
      assert.deepStrictEqual(e2.timeoutType, ['requestTimeoutMs']);
      assert.strictEqual(e2.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');
    });

    it('works w/ full override object', async () => {
      const tm = timeouts.multipart('tableAdminTimeoutMs', { timeout: { requestTimeoutMs: 10, tableAdminTimeoutMs: 50 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs']);
      assert.strictEqual(e.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');

      assert.deepStrictEqual(tm.initial(), {
        tableAdminTimeoutMs: 50,
        requestTimeoutMs: 10,
      });

      await new Promise(resolve => setTimeout(resolve, 5));
      [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 10);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.deepStrictEqual(e2.timeoutType, ['requestTimeoutMs']);
      assert.strictEqual(e2.message, 'Command timed out after 10ms (requestTimeoutMs timed out)');

      await new Promise(resolve => setTimeout(resolve, 50));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e3 = mkError();
      assert.ok(e3 instanceof TimeoutError);
      assert.deepStrictEqual(e3.info, info(tm));
      assert.deepStrictEqual(e3.timeoutType, ['tableAdminTimeoutMs']);
      assert.strictEqual(e3.message, 'Command timed out after 50ms (tableAdminTimeoutMs timed out)');
    });

    it('works w/ uniform full override object', async () => {
      const tm = timeouts.multipart('keyspaceAdminTimeoutMs', { timeout: { requestTimeoutMs: 50, keyspaceAdminTimeoutMs: 50 } });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 50);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs', 'keyspaceAdminTimeoutMs']);
      assert.strictEqual(e.message, 'Command timed out after 50ms (requestTimeoutMs and keyspaceAdminTimeoutMs simultaneously timed out)');

      assert.deepStrictEqual(tm.initial(), {
        keyspaceAdminTimeoutMs: 50,
        requestTimeoutMs: 50,
      });

      await new Promise(resolve => setTimeout(resolve, 26));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 25);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.deepStrictEqual(e2.timeoutType, ['keyspaceAdminTimeoutMs']);
      assert.strictEqual(e2.message, 'Command timed out after 50ms (keyspaceAdminTimeoutMs timed out)');

      await new Promise(resolve => setTimeout(resolve, 26));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e3 = mkError();
      assert.ok(e3 instanceof TimeoutError);
      assert.deepStrictEqual(e3.info, info(tm));
      assert.deepStrictEqual(e3.timeoutType, ['keyspaceAdminTimeoutMs']);
      assert.strictEqual(e3.message, 'Command timed out after 50ms (keyspaceAdminTimeoutMs timed out)');
    });
  });

  parallel('custom', ({ db, dbAdmin }) => {
    it('should return what it was given', () => {
      const tm = timeouts.custom({ databaseAdminTimeoutMs: 3, requestTimeoutMs: 5 }, () => [1, ['requestTimeoutMs']]);
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 1);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs']);
      assert.strictEqual(e.message, 'Command timed out after 5ms (requestTimeoutMs timed out)');

      assert.deepStrictEqual(tm.initial(), {
        databaseAdminTimeoutMs: 3,
        requestTimeoutMs: 5,
      });

      [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, 1);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.deepStrictEqual(e2.timeoutType, ['requestTimeoutMs']);
      assert.strictEqual(e2.message, 'Command timed out after 5ms (requestTimeoutMs timed out)');
    });

    it('has the httpclient throw early if timeout <= 0', async () => {
      const httpClient1 = db._httpClient as HttpClient;
      const httpClient2 = dbAdmin._httpClient as HttpClient;

      const tm1 = <const>[ 0, timeouts.custom({ requestTimeoutMs:  0 }, () => [ 0, ['requestTimeoutMs']])];
      const tm2 = <const>[-1, timeouts.custom({ requestTimeoutMs: -1 }, () => [-1, ['requestTimeoutMs']])];

      for (const [ms, tm] of [tm1, tm2]) {
        await assert.rejects(() => httpClient1['_request'](info(tm)), { message: `Command timed out after ${ms}ms (requestTimeoutMs timed out)` });
        await assert.rejects(() => httpClient2['_request'](info(tm)), { message: `Command timed out after ${ms}ms (requestTimeoutMs timed out)` });
      }
    });
  });

  // TODO
  // describe('merge', () => {
  //   it('should return the base config if new config is nullish', () => {
  //     const base = { a: 1, b: 2 } as unknown as TimeoutDescriptor;
  //     assert.strictEqual(Timeouts.merge(base, null), base);
  //     assert.strictEqual(Timeouts.merge(base, undefined), base);
  //   });
  //
  //   it('should merge the config', () => {
  //     const merged = Timeouts.merge(Timeouts.Default, { requestTimeoutMs: 1, databaseAdminTimeoutMs: 3 });
  //     assert.deepStrictEqual(merged, {
  //       requestTimeoutMs: 1,
  //       generalMethodTimeoutMs: Timeouts.Default.generalMethodTimeoutMs,
  //       keyspaceAdminTimeoutMs: Timeouts.Default.keyspaceAdminTimeoutMs,
  //       tableAdminTimeoutMs: Timeouts.Default.tableAdminTimeoutMs,
  //       collectionAdminTimeoutMs: Timeouts.Default.collectionAdminTimeoutMs,
  //       databaseAdminTimeoutMs: 3,
  //     });
  //   });
  // });
  //
  // describe('parseConfig', () => {
  //   it('should accept a nullish config', () => {
  //     assert.strictEqual(Timeouts.parseConfig(null!, ''), undefined);
  //     assert.strictEqual(Timeouts.parseConfig(undefined, ''), undefined);
  //   });
  //
  //   it('should error on a non-object config', () => {
  //     assert.throws(() => Timeouts.parseConfig(1 as any, 'timeoutDefaults'), { message: 'Expected timeoutDefaults to be of type object? (or nullish), but got number' });
  //   });
  //
  //   it('should parse timeout config', () => {
  //     const config = {
  //       requestTimeoutMs: -1,
  //       generalMethodTimeoutMs: Infinity,
  //       keyspaceAdminTimeoutMs: 3,
  //       tableAdminTimeoutMs: 4.3,
  //       collectionAdminTimeoutMs: undefined,
  //       databaseAdminTimeoutMs: undefined,
  //     };
  //
  //     assert.deepStrictEqual(Timeouts.parseConfig(config, 'timeoutDefaults'), config);
  //   });
  // });
});
