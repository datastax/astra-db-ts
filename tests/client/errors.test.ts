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

import {
  DataAPIResponseError,
  InsertManyError,
  DeleteManyError,
  mkRespErrorFromResponse,
  mkRespErrorFromResponses, UpdateManyError
} from '@/src/client/errors';
import assert from 'assert';
import { DeleteManyResult, InsertManyResult, UpdateManyResult } from '@/src/client';
import { SomeId } from '@/src/client/types/common';

describe(`Astra TS Client - astra Connection - collections.errors`, () => {
  const commands = [
    { insertOne: { document: { name: 'John' } } },
    { insertOne: { document: { name: 'Jane' } } },
  ];

  const raws = [
    { errors: [{ errorCode: 'C', message: 'Aaa', field: 'value' }] },
    { errors: [{ errorCode: 'D', message: 'Bbb', field: 'eulav' }] },
  ];

  const descriptions = [
    { errorCode: 'C', message: 'Aaa', attributes: { field: 'value' } },
    { errorCode: 'D', message: 'Bbb', attributes: { field: 'eulav' } },
  ];

  describe('DataAPIResponseError construction', () => {
    it('should properly construct a single-response DataAPIResponseError', () => {
      const err = mkRespErrorFromResponse(DataAPIResponseError, commands[0], raws[0]);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
    });

    it('should properly construct a multi-response DataAPIResponseError', () => {
      const err = mkRespErrorFromResponses(DataAPIResponseError, commands, raws);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], raw: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
    });
  });

  describe('InsertManyError construction', () => {
    const partialResult: InsertManyResult<SomeId> = { insertedIds: ['1', '2'], insertedCount: 2 };

    it('should properly construct a single-response InsertManyError', () => {
      const err = mkRespErrorFromResponse(InsertManyError<SomeId>, commands[0], raws[0], partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
    });

    it('should properly construct a multi-response InsertManyError', () => {
      const err = mkRespErrorFromResponses(InsertManyError<SomeId>, commands, raws, partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], raw: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
    });
  });

  describe('DeleteManyError construction', () => {
    const partialResult: DeleteManyResult = { deletedCount: 2 };

    it('should properly construct a single-response DeleteManyError', () => {
      const err = mkRespErrorFromResponse(DeleteManyError, commands[0], raws[0], partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
    });

    it('should properly construct a multi-response DeleteManyError', () => {
      const err = mkRespErrorFromResponses(DeleteManyError, commands, raws, partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], raw: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
    });
  });

  describe('UpdateManyError construction', () => {
    const partialResult: UpdateManyResult = { matchedCount: 2, modifiedCount: 2 };

    it('should properly construct a single-response UpdateManyError', () => {
      const err = mkRespErrorFromResponse(UpdateManyError, commands[0], raws[0], partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
    });

    it('should properly construct a multi-response UpdateManyError', () => {
      const err = mkRespErrorFromResponses(UpdateManyError, commands, raws, partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], raw: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], raw: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
    });
  });
});
