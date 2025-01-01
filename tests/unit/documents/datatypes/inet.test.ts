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
import { InetAddress } from '@/src/documents';
import { describe, it } from '@/tests/testlib';

const IPV4 = '127.0.0.1';
const IPV6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';

describe('unit.documents.datatypes.inet', () => {
  describe('construction', () => {
    it('should properly construct an IPv4 address', () => {
      const explicit = new InetAddress(IPV4, 4);
      assert.strictEqual(explicit.toString(), IPV4);
      assert.strictEqual(explicit.version, 4);

      const implicit = new InetAddress(IPV4);
      assert.strictEqual(implicit.toString(), IPV4);
      assert.strictEqual(implicit.version, 4);
    });

    it('should properly construct an IPv6 address', () => {
      const explicit = new InetAddress(IPV6, 6);
      assert.strictEqual(explicit.toString(), IPV6);
      assert.strictEqual(explicit.version, 6);

      const implicit = new InetAddress(IPV6);
      assert.strictEqual(implicit.toString(), IPV6);
      assert.strictEqual(implicit.version, 6);
    });
  });

  describe('validation', () => {
    it('should error on invalid IPv4', () => {
      assert.throws(() => new InetAddress(IPV6, 4));
    });

    it('should error on invalid IPv6', () => {
      assert.throws(() => new InetAddress(IPV4, 6));
    });

    it('should error on invalid IP', () => {
      assert.throws(() => new InetAddress('i like dogs'));
    });

    it('should error on invalid type', () => {
      assert.throws(() => new InetAddress({} as any), Error);
    });

    it('should allow force creation of invalid values', () => {
      assert.strictEqual(new InetAddress('abc', 4, false).version, 4);
      assert.strictEqual(new InetAddress(IPV6, 4, false).version, 4);
      assert.throws(() => new InetAddress({} as any, 4, false).version, TypeError);
    });
  });
});
