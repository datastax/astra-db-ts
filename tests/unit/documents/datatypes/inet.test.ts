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
import { DataAPIInet, inet } from '@/src/documents/index.js';
import { describe, it } from '@/tests/testlib/index.js';
import fc from 'fast-check';
import { tryCatchErrSync } from '@/tests/testlib/utils.js';

describe('unit.documents.datatypes.inet', () => {
  describe('construction', () => {
    it('should properly construct an IPv4 address', () => {
      fc.assert(
        fc.property(fc.mixedCase(fc.ipV4()), (ip) => {
          const validate = (inet: DataAPIInet) => {
            assert.strictEqual(inet.toString(), ip.toLowerCase());
            assert.strictEqual(inet.version, 4);
          };

          validate(new DataAPIInet(ip));
          validate(new DataAPIInet(ip, 4));
          validate(new DataAPIInet(ip, 4, false));
          validate(new DataAPIInet(ip, null, false));

          validate(inet(ip));
          validate(inet(ip, 4));
        }),
      );
    });

    it('should properly construct an IPv6 address', () => {
      fc.assert(
        fc.property(fc.mixedCase(fc.ipV6()), (ip) => {
          const validate = (inet: DataAPIInet) => {
            assert.strictEqual(inet.toString(), ip.toLowerCase());
            assert.strictEqual(inet.version, 6);
          };

          validate(new DataAPIInet(ip));
          validate(new DataAPIInet(ip, 6));
          validate(new DataAPIInet(ip, 6, false));
          validate(new DataAPIInet(ip, null, false));

          validate(inet(ip));
          validate(inet(ip, 6));
        }),
      );
    });

    it('should throw on invalid IPs', () => {
      for (const version of [4, 6, undefined] as const) {
        fc.assert(
          fc.property(fc.string(), (ip) => {
            fc.pre(!DataAPIInet.isIPv4(ip) && !DataAPIInet.isIPv6(ip));
            assert.throws(() => new DataAPIInet(ip, version));
          }),
        );
      }
    });

    it('should allow force creation of invalid values', () => {
      for (const version of [4, 6, undefined] as const) {
        fc.assert(
          fc.property(fc.anything(), (ip) => {
            if (ip !== null && (typeof ip === 'string' || typeof ip === 'object' && 'toLowerCase' in ip && typeof ip.toLowerCase === 'function')) {
              assert.doesNotThrow(() => new DataAPIInet(ip as any, version, false));
            } else {
              assert.throws(() => new DataAPIInet(ip as any, version, false), TypeError);
            }
          }), {
            examples: [[{ toLowerCase: () => 3 }]],
          },
        );
      }
    });
  });

  describe('validation', () => {
    describe('isIPv4', () => {
      it('should return true for valid IPv4 addresses', () => {
        fc.assert(
          fc.property(fc.mixedCase(fc.ipV4()), (ip) => {
            assert.ok(DataAPIInet.isIPv4(ip));
          }),
        );
      });

      it('should return false for valid IPv6 addresses', () => {
        fc.assert(
          fc.property(fc.string(), (ip) => {
            fc.pre(tryCatchErrSync(() => new URL(`https://[${ip}]`)) !== undefined);
            assert.ok(!DataAPIInet.isIPv4(ip));
          }), {
            examples: [['a'], ['a'.repeat(100)]],
          },
        );
      });
    });

    describe('isIPv6', () => {
      it('should return true for valid IPv6 addresses', () => {
        fc.assert(
          fc.property(fc.mixedCase(fc.ipV6()), (ip) => {
            assert.ok(DataAPIInet.isIPv6(ip));
          }),
        );
      });

      it('should return false for valid IPv6 addresses', () => {
        fc.assert(
          fc.property(fc.string(), (ip) => {
            fc.pre(tryCatchErrSync(() => new URL(`https://[${ip}]`)) !== undefined);
            assert.ok(!DataAPIInet.isIPv6(ip));
          }), {
            examples: [['a'], ['a'.repeat(100)]],
          },
        );
      });
    });
  });
});
