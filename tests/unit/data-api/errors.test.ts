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

import { DataAPIResponseError, DeleteManyError, InsertManyError, SomeDoc, UpdateManyError } from '@/src/data-api';
import { DeleteManyResult, InsertManyResult, UpdateManyResult } from '@/src/data-api/types';
import { mkRespErrorFromResponse, mkRespErrorFromResponses } from '@/src/data-api/errors';
import { describe, it } from '@/tests/testlib';
import assert from 'assert';

describe('unit.data-api.errors', () => {
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
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.name, 'DataAPIResponseError');
    });

    it('should properly construct a multi-response DataAPIResponseError', () => {
      const err = mkRespErrorFromResponses(DataAPIResponseError, commands, raws);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.name, 'DataAPIResponseError');
    });
  });

  describe('InsertManyError construction', () => {
    const partialResult: InsertManyResult<SomeDoc> = { insertedIds: ['1', '2'], insertedCount: 2 };

    it('should properly construct a single-response InsertManyError', () => {
      const err = mkRespErrorFromResponse(InsertManyError, commands[0], raws[0], partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'InsertManyError');
    });

    it('should properly construct a multi-response InsertManyError', () => {
      const err = mkRespErrorFromResponses(InsertManyError, commands, raws, partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'InsertManyError');
    });
  });

  describe('DeleteManyError construction', () => {
    const partialResult: DeleteManyResult = { deletedCount: 2 };

    it('should properly construct a single-response DeleteManyError', () => {
      const err = mkRespErrorFromResponse(DeleteManyError, commands[0], raws[0], partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'DeleteManyError');
    });

    it('should properly construct a multi-response DeleteManyError', () => {
      const err = mkRespErrorFromResponses(DeleteManyError, commands, raws, partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'DeleteManyError');
    });
  });

  describe('UpdateManyError construction', () => {
    const partialResult: UpdateManyResult<SomeDoc> = { matchedCount: 2, modifiedCount: 2, upsertedCount: 0 };

    it('should properly construct a single-response UpdateManyError', () => {
      const err = mkRespErrorFromResponse(UpdateManyError, commands[0], raws[0], partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'UpdateManyError');
    });

    it('should properly construct a multi-response UpdateManyError', () => {
      const err = mkRespErrorFromResponses(UpdateManyError, commands, raws, partialResult);
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'UpdateManyError');
    });
  });
});
