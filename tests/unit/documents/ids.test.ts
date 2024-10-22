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
import { ObjectId, UUID } from '@/src/documents';
import { describe, it } from '@/tests/testlib';

describe('unit.documents.ids', () => {
  describe('UUID', () => {
    it('should properly construct a UUID', () => {
      const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(uuid.toString(), '123e4567-e89b-12d3-a456-426614174000');
    });

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

    it('should properly construct a UUIDv4', () => {
      const uuid = UUID.v4();
      assert.strictEqual(uuid.version, 4);
    });

    it('should properly construct a UUIDv7', () => {
      const uuid = UUID.v7();
      assert.strictEqual(uuid.version, 7);
    });

    it('should properly parse a UUIDv4', () => {
      const uuid = UUID.v4();
      const parsed = new UUID(uuid.toString());
      assert.strictEqual(parsed.toString(), uuid.toString());
      assert.strictEqual(parsed.version, 4);
    });

    it('should properly parse a UUIDv7', () => {
      const uuid = UUID.v7();
      const parsed = new UUID(uuid.toString());
      assert.strictEqual(parsed.toString(), uuid.toString());
      assert.strictEqual(parsed.version, 7);
    });

    it('should get creation date from UUIDv7', () => {
      const uuid = UUID.v7();
      const date = uuid.getTimestamp();
      assert(date instanceof Date);
    });

    it('should not get creation date from UUIDv4', () => {
      const uuid = UUID.v4();
      const date = uuid.getTimestamp();
      assert.strictEqual(date, undefined);
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
      assert.ok(uuid.equals('123e4567-e89b-12d3-a456-426614174000'));
    });

    it('should not equal an invalid type', () => {
      const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
      assert(!uuid.equals({}));
    });

    it('should properly serialize to JSON', () => {
      const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
      assert.deepStrictEqual(uuid.toJSON(), { $uuid: '123e4567-e89b-12d3-a456-426614174000' });
      assert.strictEqual(JSON.stringify(uuid), '{"$uuid":"123e4567-e89b-12d3-a456-426614174000"}');
    });
  });

  describe('ObjectId', () => {
    it('should properly construct an ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert.strictEqual(objectId.toString(), '507f191e810c19729de860ea');
    });

    it('should properly generate an ObjectId', () => {
      const objectId = new ObjectId();
      assert.strictEqual(objectId.toString().length, 24);
    });

    it('should properly construct an ObjectId given timestamp', () => {
      const objectId = new ObjectId(123123123);
      assert.strictEqual(objectId.getTimestamp().toDateString(), new Date(123123123 * 1000).toDateString());
    });

    it('should error on invalid ObjectId', () => {
      assert.throws(() => new ObjectId('507f191e810c19729de860e'));
    });

    it('should error on invalid type', () => {
      assert.throws(() => new ObjectId({} as any));
    });

    it('should "allow" force construction on invalid ObjectId', () => {
      const objectId = new ObjectId('23d032jd', false);
      assert.ok(objectId.equals('23d032jd'));
    });

    it('should "allow" force construction on invalid type', () => {
      const objectId = new ObjectId(<any>{}, false);
      assert.ok(objectId.toString());
    });

    it('should properly parse an ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      const parsed = new ObjectId(objectId.toString());
      assert.strictEqual(parsed.toString(), objectId.toString());
    });

    it('should get creation date from ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      const date = objectId.getTimestamp();
      assert(<any>date instanceof Date);
    });

    it('should equal a similar ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      const other = new ObjectId('507F191E810C19729DE860EA');
      assert.ok(objectId.equals(other));
    });

    it('should not equal a different ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      const other = new ObjectId('507f191e810c19729de860eb');
      assert.ok(!objectId.equals(other));
    });

    it('should equal a string representation', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert.ok(objectId.equals('507f191e810c19729de860ea'));
    });

    it('should not equal an invalid type', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert(!objectId.equals({}));
    });

    it('should properly serialize to JSON', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert.deepStrictEqual(objectId.toJSON(), { $objectId: '507f191e810c19729de860ea' });
      assert.strictEqual(JSON.stringify(objectId), '{"$objectId":"507f191e810c19729de860ea"}');
    });
  });
});
