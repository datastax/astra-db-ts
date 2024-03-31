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
import { ObjectId, UUID } from '@/src/data-api';
import { BSONError } from 'bson';

describe('unit.data-api.ids tests', () => {
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

    it('should inspect properly', () => {
      const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(uuid.inspect(), 'UUID("123e4567-e89b-12d3-a456-426614174000")');
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
  });

  describe('ObjectId', () => {
    it('should properly construct an ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert.strictEqual(objectId.toString(), '507f191e810c19729de860ea');
    });

    it('should error on invalid ObjectId', () => {
      assert.throws(() => new ObjectId('507f191e810c19729de860e'));
    });

    it('should error on invalid type', () => {
      assert.throws(() => new ObjectId({} as any));
    });

    it('should "allow" force construction on invalid ObjectId', () => {
      assert.throws(() => new ObjectId('507f191e810c19729de860e', false), BSONError);
    });

    it('should "allow" force construction on invalid type', () => {
      assert.throws(() => new ObjectId({} as any, false), BSONError);
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

    it('should inspect properly', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert.strictEqual(objectId.inspect(), 'ObjectId("507f191e810c19729de860ea")');
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
  });

  // describe('replaceRawId', () => {
  //   it('should return null for null', () => {
  //     assert.strictEqual(replaceRawId(null), null);
  //   });
  //
  //   it('should return same id if not special id', () => {
  //     assert.strictEqual(replaceRawId('some_id'), 'some_id');
  //   });
  //
  //   it('should return UUID if $uuid', () => {
  //     const id = { $uuid: '123e4567-e89b-12d3-a456-426614174000' };
  //     const replaced = replaceRawId(id);
  //     assert(replaced instanceof UUID);
  //     assert.strictEqual(replaced.toString(), '123e4567-e89b-12d3-a456-426614174000');
  //   });
  //
  //   it('should return ObjectId if $objectId', () => {
  //     const id = { $objectId: '507f191e810c19729de860ea' };
  //     const replaced = replaceRawId(id);
  //     assert(replaced instanceof ObjectId);
  //     assert.strictEqual(replaced.toString(), '507f191e810c19729de860ea');
  //   });
  //
  //   it('should return same id if not special id _id', () => {
  //     const id = { _id: 'some_id' };
  //     const replaced = replaceRawId(id);
  //     assert.strictEqual(replaced._id, 'some_id');
  //   });
  //
  //   it('should return UUID if $uuid _id', () => {
  //     const id = { _id: { $uuid: '123e4567-e89b-12d3-a456-426614174000' } };
  //     const replaced = replaceRawId(id);
  //     assert(replaced._id instanceof UUID);
  //     assert.strictEqual(replaced._id.toString(), '123e4567-e89b-12d3-a456-426614174000');
  //   });
  //
  //   it('should return ObjectId if $objectId _id', () => {
  //     const id = { _id: { $objectId: '507f191e810c19729de860ea' } };
  //     const replaced = replaceRawId(id);
  //     assert(replaced._id instanceof ObjectId);
  //     assert.strictEqual(replaced._id.toString(), '507f191e810c19729de860ea');
  //   });
  //
  //   it('Mutates the original object if on _id', () => {
  //     const id = { _id: { $uuid: '123e4567-e89b-12d3-a456-426614174000' } };
  //     replaceRawId(id);
  //     assert(<any>id._id instanceof UUID);
  //     assert.strictEqual(id._id.toString(), '123e4567-e89b-12d3-a456-426614174000');
  //   });
  // });
});
