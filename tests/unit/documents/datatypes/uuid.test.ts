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
import { uuid, UUID } from '@/src/documents';
import { describe, it } from '@/tests/testlib';
import { $CustomInspect } from '@/src/lib/constants';

describe('unit.documents.datatypes.uuid', () => {
  describe('construction', () => {
    it('should properly construct a UUID', () => {
      const id = new UUID('123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(id.toString(), '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should properly construct a UUID using the shorthand', () => {
      const id = uuid('123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(id.toString(), '123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('validation', () => {
    it('should error on invalid UUID', () => {
      assert.throws(() => new UUID('123e4567-e89b-12d3-a456-42661417400'));
    });

    it('should error on invalid type', () => {
      assert.throws(() => new UUID({} as any));
    });

    it('should allow force construction on invalid UUID', () => {
      assert.ok(new UUID('abc', false));
    });

    it('should allow force construction on invalid type', () => {
      assert.throws(() => new UUID({} as any, false), TypeError);
    });
  });

  it('should work with v1s', () => {
    const genLong = UUID.v1();
    const genShort = uuid(1);

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
    const genShort = uuid(4);

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
    const genShort = uuid(6);

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
    const genShort = uuid(7);

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
    const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
    const other = new UUID('123E4567-E89B-12D3-A456-426614174000');
    assert.ok(uuid.equals(other));
  });

  it('should not equal a different UUID', () => {
    const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
    const other = new UUID('123e4567-e89b-12d3-a456-426614174001');
    assert.ok(!uuid.equals(other));
  });

  it('should equal a string representation', () => {
    const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
    assert.ok(uuid.equals('123e4567-E89b-12D3-A456-426614174000'));
  });

  it('should not equal an invalid type', () => {
    const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
    assert(!uuid.equals({}));
  });

  it('should have a working inspect', () => {
    assert.strictEqual((uuid('123e4567-E89b-12D3-A456-426614174000') as any)[$CustomInspect](), 'UUID<1>("123e4567-e89b-12d3-a456-426614174000")');
  });
});
