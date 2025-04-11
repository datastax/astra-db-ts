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
import type { TimedOutCategories, TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import { EffectivelyInfinity, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { DataAPIHttpClient, DevOpsAPIHttpClient, HTTPRequestInfo } from '@/src/lib/api/clients/index.js';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';

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
      fc.assert(
        fc.property(fc.nat(), (overrideMs) => {
          const tm = timeouts.single('generalMethodTimeoutMs', { timeout: overrideMs });
          const [timeout, mkError] = tm.advance(info(tm));

          const expectedOverrideMs = overrideMs || EffectivelyInfinity;
          assert.strictEqual(timeout, expectedOverrideMs);

          const e = mkError();
          assert.ok(e instanceof TimeoutError);
          assert.deepStrictEqual(e.info, info(tm));
          assert.deepStrictEqual(e.timeoutType, 'provided');
          assert.strictEqual(e.message, `Command timed out after ${expectedOverrideMs}ms (The timeout provided via \`{ timeout: <number> }\` timed out)`);

          assert.deepStrictEqual(tm.initial(), {
            generalMethodTimeoutMs: expectedOverrideMs,
            requestTimeoutMs: expectedOverrideMs,
          });
        }), {
          examples: [[0]],
        },
      );
    });

    it('works w/ partial override object', () => {
      fc.assert(
        fc.property(fc.nat(), fc.nat(), (overrideDA, overrideGM) => {
          const tm = timeouts.single('databaseAdminTimeoutMs', { timeout: { generalMethodTimeoutMs: overrideGM, databaseAdminTimeoutMs: overrideDA } });
          const [timeout, mkError] = tm.advance(info(tm));

          const expectedOverrideDA = overrideDA || EffectivelyInfinity;
          const expectedOverrideMs = Math.min(Timeouts.Default.requestTimeoutMs, expectedOverrideDA);
          assert.strictEqual(timeout, expectedOverrideMs);

          const expectedOverrideField = (Timeouts.Default.requestTimeoutMs > expectedOverrideDA)
            ? 'databaseAdminTimeoutMs'
            : 'requestTimeoutMs';

          const e = mkError();
          assert.ok(e instanceof TimeoutError);
          assert.deepStrictEqual(e.info, info(tm));

          if (Timeouts.Default.requestTimeoutMs === expectedOverrideDA) {
            assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs', 'databaseAdminTimeoutMs']);
            assert.strictEqual(e.message, `Command timed out after ${expectedOverrideMs}ms (requestTimeoutMs and databaseAdminTimeoutMs simultaneously timed out)`);
          } else {
            assert.deepStrictEqual(e.timeoutType, [expectedOverrideField]);
            assert.strictEqual(e.message, `Command timed out after ${expectedOverrideMs}ms (${expectedOverrideField} timed out)`);
          }

          assert.deepStrictEqual(tm.initial(), {
            requestTimeoutMs: Timeouts.Default.requestTimeoutMs,
            databaseAdminTimeoutMs: expectedOverrideDA,
          });
        }), {
          examples: [
            [Timeouts.Default.requestTimeoutMs, arbs.one(fc.nat())],
            [0, 0],
          ],
        },
      );
    });

    it('works w/ full override object', () => {
      fc.assert(
        fc.property(fc.nat(), fc.nat(), fc.nat(), (overrideDA, overrideRT, overrideGM) => {
          const tm = timeouts.single('databaseAdminTimeoutMs', { timeout: { generalMethodTimeoutMs: overrideGM, requestTimeoutMs: overrideRT, databaseAdminTimeoutMs: overrideDA } });
          const [timeout, mkError] = tm.advance(info(tm));

          const expectedOverrideDA = overrideDA || EffectivelyInfinity;
          const expectedOverrideRT = overrideRT || EffectivelyInfinity;
          const expectedOverrideMs = Math.min(expectedOverrideRT, expectedOverrideDA);
          assert.strictEqual(timeout, expectedOverrideMs);

          const expectedOverrideField = (expectedOverrideRT > expectedOverrideDA)
            ? 'databaseAdminTimeoutMs'
            : 'requestTimeoutMs';

          const e = mkError();
          assert.ok(e instanceof TimeoutError);
          assert.deepStrictEqual(e.info, info(tm));

          if (expectedOverrideRT === expectedOverrideDA) {
            assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs', 'databaseAdminTimeoutMs']);
            assert.strictEqual(e.message, `Command timed out after ${expectedOverrideMs}ms (requestTimeoutMs and databaseAdminTimeoutMs simultaneously timed out)`);
          } else {
            assert.deepStrictEqual(e.timeoutType, [expectedOverrideField]);
            assert.strictEqual(e.message, `Command timed out after ${expectedOverrideMs}ms (${expectedOverrideField} timed out)`);
          }

          assert.deepStrictEqual(tm.initial(), {
            databaseAdminTimeoutMs: expectedOverrideDA,
            requestTimeoutMs: expectedOverrideRT,
          });
        }), {
          examples: [
            [123, 123, arbs.one(fc.nat())],
            [0, 0, 0],
          ],
        },
      );
    });
  });

  parallel('multipart', () => {
    it('(LONG) works w/ override number', async () => {
      const tm = timeouts.multipart('generalMethodTimeoutMs', { timeout: Timeouts.Default.requestTimeoutMs + 1 });
      let [timeout, mkError] = tm.advance(info(tm));
      assert.strictEqual(timeout, Timeouts.Default.requestTimeoutMs);

      const e = mkError();
      assert.ok(e instanceof TimeoutError);
      assert.deepStrictEqual(e.info, info(tm));
      assert.deepStrictEqual(e.timeoutType, ['requestTimeoutMs']);
      assert.strictEqual(e.message, `Command timed out after ${Timeouts.Default.requestTimeoutMs}ms (requestTimeoutMs timed out)`);

      assert.deepStrictEqual(tm.initial(), {
        requestTimeoutMs: Timeouts.Default.requestTimeoutMs,
        generalMethodTimeoutMs: Timeouts.Default.requestTimeoutMs + 1,
      });

      await new Promise(resolve => setTimeout(resolve, 7501));
      [timeout] = tm.advance(info(tm));
      assert.ok(timeout <= 7500.5);

      await new Promise(resolve => setTimeout(resolve, 7501));
      [timeout, mkError] = tm.advance(info(tm));
      assert.ok(timeout <= 0);

      const e2 = mkError();
      assert.ok(e2 instanceof TimeoutError);
      assert.deepStrictEqual(e2.info, info(tm));
      assert.deepStrictEqual(e2.timeoutType, ['generalMethodTimeoutMs']);
      assert.strictEqual(e2.message, `Command timed out after ${Timeouts.Default.requestTimeoutMs + 1}ms (generalMethodTimeoutMs timed out)`);
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
      assert.ok(timeout >= 49);

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

    it('should set the proper initial timeout', () => {
      fc.assert(
        fc.property(fc.option(fc.nat()), fc.option(fc.nat()), fc.option(fc.nat()), (overrideDA, overrideRT, overrideGM) => {
          const tm = timeouts.multipart('databaseAdminTimeoutMs', { timeout: { generalMethodTimeoutMs: overrideGM, requestTimeoutMs: overrideRT, databaseAdminTimeoutMs: overrideDA } });

          assert.deepStrictEqual(tm.initial(), {
            databaseAdminTimeoutMs: (overrideDA ?? Timeouts.Default.databaseAdminTimeoutMs) || EffectivelyInfinity,
            requestTimeoutMs: (overrideRT ?? Timeouts.Default.requestTimeoutMs) || EffectivelyInfinity,
          });
        }),
      );
    });
  });

  parallel('custom', ({ db, dbAdmin }) => {
    it('should return what it was given', () => {
      const timeoutTypeArb = fc.constantFrom('requestTimeoutMs', 'databaseAdminTimeoutMs');

      fc.assert(
        fc.property(fc.nat(), fc.nat(), fc.nat(), timeoutTypeArb, (overrideDA, overrideRT, advanceMS, timeoutType) => {
          const tm = timeouts.custom({ databaseAdminTimeoutMs: overrideDA, requestTimeoutMs: overrideRT }, () => [advanceMS, [timeoutType]]);

          for (let i = 0; i < 10; i++) {
            const [timeout, mkError] = tm.advance(info(tm));
            assert.strictEqual(timeout, advanceMS);

            const e = mkError();
            assert.ok(e instanceof TimeoutError);
            assert.deepStrictEqual(e.info, info(tm));
            assert.deepStrictEqual(e.timeoutType, [timeoutType]);
            assert.strictEqual(e.message, `Command timed out after ${timeoutType === 'requestTimeoutMs' ? overrideRT : overrideDA}ms (${timeoutType} timed out)`);

            assert.deepStrictEqual(tm.initial(), {
              databaseAdminTimeoutMs: overrideDA,
              requestTimeoutMs: overrideRT,
            });
          }
        }), {
          examples: [[0, 0, 0, arbs.one(timeoutTypeArb)]],
        },
      );
    });

    it('has the httpclient throw early if timeout <= 0', async () => {
      const httpClient1 = db._httpClient as DataAPIHttpClient;
      const httpClient2 = dbAdmin._httpClient as DevOpsAPIHttpClient;

      const tm1 = <const>[ 0, timeouts.custom({ requestTimeoutMs: +0 }, () => [ 0, ['requestTimeoutMs']])];
      const tm2 = <const>[ 0, timeouts.custom({ requestTimeoutMs: -0 }, () => [ 0, ['requestTimeoutMs']])];
      const tm3 = <const>[-1, timeouts.custom({ requestTimeoutMs: -1 }, () => [-1, ['requestTimeoutMs']])];

      for (const [ms, tm] of [tm1, tm2, tm3]) {
        for (let i = 0; i < 10; i++) {
          await assert.rejects(() => httpClient1['_request'](info(tm)), { message: `Command timed out after ${ms}ms (requestTimeoutMs timed out)` });
          await assert.rejects(() => httpClient2['_request'](info(tm)), { message: `Command timed out after ${ms}ms (requestTimeoutMs timed out)` });
        }
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
