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
import { UUID, ObjectId } from '@/src/client';

describe(`Astra TS Client - astra Connection - collections.errors`, () => {
  describe('UUID tests', () => {
    it('Should properly construct a UUID', () => {
      const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(uuid.toString(), '123e4567-e89b-12d3-a456-426614174000');
    });

    it('Should error on invalid UUID', () => {
      assert.throws(() => new UUID('123e4567-e89b-12d3-a456-42661417400'));
    });

    it('Should properly construct a UUIDv4', () => {
      const uuid = UUID.v4();
      assert.strictEqual(uuid.version, 4);
    });

    it('Should properly construct a UUIDv7', () => {
      const uuid = UUID.v7();
      assert.strictEqual(uuid.version, 7);
    });

    it('Should properly parse a UUIDv4', () => {
      const uuid = UUID.v4();
      const parsed = new UUID(uuid.toString());
      assert.strictEqual(parsed.toString(), uuid.toString());
      assert.strictEqual(parsed.version, 4);
    });

    it('Should properly parse a UUIDv7', () => {
      const uuid = UUID.v7();
      const parsed = new UUID(uuid.toString());
      assert.strictEqual(parsed.toString(), uuid.toString());
      assert.strictEqual(parsed.version, 7);
    });

    it('Should get creation date from UUIDv7', () => {
      const uuid = UUID.v7();
      const date = uuid.getTimestamp();
      assert(date instanceof Date);
    });

    it('Should not get creation date from UUIDv4', () => {
      const uuid = UUID.v4();
      const date = uuid.getTimestamp();
      assert.strictEqual(date, undefined);
    });

    it('Should inspect properly', () => {
      const uuid = new UUID('123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(uuid.inspect(), 'UUID("123e4567-e89b-12d3-a456-426614174000")');
    });
  });

  describe('ObjectId tests', () => {
    it('Should properly construct an ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert.strictEqual(objectId.toString(), '507f191e810c19729de860ea');
    });

    it('Should error on invalid ObjectId', () => {
      assert.throws(() => new ObjectId('507f191e810c19729de860e'));
    });

    it('Should properly parse an ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      const parsed = new ObjectId(objectId.toString());
      assert.strictEqual(parsed.toString(), objectId.toString());
    });

    it('Should get creation date from ObjectId', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      const date = objectId.getTimestamp();
      assert(<any>date instanceof Date);
    });

    it('Should inspect properly', () => {
      const objectId = new ObjectId('507f191e810c19729de860ea');
      assert.strictEqual(objectId.inspect(), 'ObjectId("507f191e810c19729de860ea")');
    });
  });
});
