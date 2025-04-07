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
import { ObjectId, oid } from '@/src/documents/index.js';
import { describe, it } from '@/tests/testlib/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';

describe('unit.documents.datatypes.object-id', () => {
  it('should properly construct an ObjectId', () => {
    const objectId = new ObjectId('507f191e810c19729de860ea');
    assert.strictEqual(objectId.toString(), '507f191e810c19729de860ea');
  });

  it('should properly construct an ObjectId using the shorthand', () => {
    const objectId = oid('507f191e810c19729de860ea');
    assert.strictEqual(objectId.toString(), '507f191e810c19729de860ea');
  });

  it('should properly construct an ObjectId from another ObjectId', () => {
    const objectId = new ObjectId(oid('507f191e810c19729de860ea'));
    assert.strictEqual(objectId.toString(), '507f191e810c19729de860ea');
  });

  it('should properly generate an ObjectId', () => {
    const objectId = new ObjectId();
    assert.strictEqual(objectId.toString().length, 24);
  });

  it('should properly generate an ObjectId using the shorthand', () => {
    const objectId = oid();
    assert.strictEqual(objectId.toString().length, 24);
  });

  it('should properly construct an ObjectId given timestamp', () => {
    const objectId = new ObjectId(123123123);
    assert.strictEqual(objectId.getTimestamp().toDateString(), new Date(123123123 * 1000).toDateString());
  });

  it('should properly construct an ObjectId given timestamp using the shorthand', () => {
    const objectId = oid(123123123);
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
    assert.ok(objectId.equals('507f191e810c19729DE860EA'));
  });

  it('should not equal an invalid type', () => {
    const objectId = new ObjectId('507f191e810c19729de860ea');
    assert(!objectId.equals({}));
  });

  it('should have a working inspect', () => {
    assert.strictEqual((oid('507f191e810c19729de860ea') as any)[$CustomInspect](), 'ObjectId("507f191e810c19729de860ea")');
  });
});
