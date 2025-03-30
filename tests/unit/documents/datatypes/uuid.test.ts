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
import { uuid, UUID } from '@/src/documents/index.js';
import { describe, it } from '@/tests/testlib/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import fc from 'fast-check';
import * as uuidModule from 'uuid';

describe('unit.documents.datatypes.uuid', () => {
  describe('construction', () => {
    it('should properly construct a UUID', () => {
      fc.assert(
        fc.property(fc.uuid(), (generated) => {
          assert.strictEqual(new UUID(generated).toString(), generated);
          assert.strictEqual(uuid(generated).toString(), generated);
        }),
      );
    });
  });

  describe('validation', () => {
    it('should error on invalid UUID', () => {
      assert.throws(() => new UUID('123e4567-e89b-12d3-a456-42661417400'));

      fc.assert(
        fc.property(fc.string(), (generated) => {
          fc.pre(!uuidModule.validate(generated));
          assert.throws(() => new UUID(generated));
        }),
      );
    });

    it('should error on invalid type', () => {
      fc.assert(
        fc.property(fc.anything(), (generated) => {
          fc.pre(typeof generated !== 'string');
          assert.throws(() => new UUID(generated as any));
        }),
      );
    });

    it('should allow force construction on invalid UUID strings', () => {
      fc.assert(
        fc.property(fc.string(), (generated) => {
          assert.ok(new UUID(generated as any, false));
        }),
      );
    });
  });

  it('should work with v1s', () => {
    const genLong = UUID.v1();
    const genShort = uuid.v1();

    const parsedLong = new UUID(genLong.toString());
    const parsedShort = new UUID(genShort.toString());

    assert.strictEqual(genLong.version, 1);
    assert.strictEqual(genShort.version, 1);
    assert.strictEqual(parsedLong.version, 1);
    assert.strictEqual(parsedShort.version, 1);

    assert.strictEqual(parsedLong.toString(), genLong.toString());
    assert.strictEqual(parsedShort.toString(), genShort.toString());

    assert.strictEqual(typeof parsedLong.getTimestamp(), 'object');
    assert.strictEqual(typeof parsedShort.getTimestamp(), 'object');

    const exact = UUID.v1(12345);
    const parsed = new UUID(exact.toString());
    assert.strictEqual(parsed.getTimestamp()?.valueOf(), 12345);
  });

  it('should work with v4s', () => {
    const genLong = UUID.v4();
    const genShort = uuid.v4();

    const parsedLong = new UUID(genLong.toString());
    const parsedShort = new UUID(genShort.toString());

    assert.strictEqual(genLong.version, 4);
    assert.strictEqual(genShort.version, 4);
    assert.strictEqual(parsedLong.version, 4);
    assert.strictEqual(parsedShort.version, 4);

    assert.strictEqual(parsedLong.toString(), genLong.toString());
    assert.strictEqual(parsedShort.toString(), genShort.toString());

    assert.strictEqual(parsedLong.getTimestamp(), undefined);
    assert.strictEqual(parsedShort.getTimestamp(), undefined);
  });

  it('should work with v6s', () => {
    const genLong = UUID.v6();
    const genShort = uuid.v6();

    const parsedLong = new UUID(genLong.toString());
    const parsedShort = new UUID(genShort.toString());

    assert.strictEqual(genLong.version, 6);
    assert.strictEqual(genShort.version, 6);
    assert.strictEqual(parsedLong.version, 6);
    assert.strictEqual(parsedShort.version, 6);

    assert.strictEqual(parsedLong.toString(), genLong.toString());
    assert.strictEqual(parsedShort.toString(), genShort.toString());

    assert.strictEqual(parsedLong.getTimestamp(), undefined);
    assert.strictEqual(parsedShort.getTimestamp(), undefined);
  });

  it('should work with v7s', () => {
    const genLong = UUID.v7();
    const genShort = uuid.v7();

    const parsedLong = new UUID(genLong.toString());
    const parsedShort = new UUID(genShort.toString());

    assert.strictEqual(genLong.version, 7);
    assert.strictEqual(genShort.version, 7);
    assert.strictEqual(parsedLong.version, 7);
    assert.strictEqual(parsedShort.version, 7);

    assert.strictEqual(parsedLong.toString(), genLong.toString());
    assert.strictEqual(parsedShort.toString(), genShort.toString());

    assert.strictEqual(typeof parsedLong.getTimestamp(), 'object');
    assert.strictEqual(typeof parsedShort.getTimestamp(), 'object');

    const exact = UUID.v7(12345);
    const parsed = new UUID(exact.toString());
    assert.strictEqual(parsed.getTimestamp()?.valueOf(), 12345);
  });

  it('should equal a similar UUID', () => {
    fc.assert(
      fc.property(fc.uuid().chain(uuid => fc.tuple(fc.constant(uuid), fc.mixedCase(fc.constant(uuid)))), ([uuid1, uuid2]) => {
        assert.ok(uuid(uuid1).equals(uuid2));
        assert.ok(uuid(uuid1).equals(uuid(uuid2)));
      }),
    );
  });

  it('should not equal a different UUID', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (uuid1, uuid2) => {
        fc.pre(uuid1 !== uuid2);
        assert.ok(!uuid(uuid1).equals(uuid2));
        assert.ok(!uuid(uuid1).equals(uuid(uuid2)));
      }),
    );
  });

  it('should not equal an invalid type', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.anything(), (uuid1, uuid2) => {
        fc.pre(typeof uuid2 !== 'string');
        assert.ok(!uuid(uuid1).equals(uuid2 as any));
      }),
    );
  });

  it('should have a working inspect', () => {
    fc.assert(
      fc.property(fc.mixedCase(fc.uuid()), (generated) => {
        const uuid = new UUID(generated);
        assert.strictEqual((uuid as any)[$CustomInspect](), `UUID<${uuid.version}>("${generated.toLowerCase()}")`);
      }),
    );
  });
});
