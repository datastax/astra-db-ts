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

import { CollectionDeleteManyResult, CollectionInsertManyResult, SomeDoc, CollectionUpdateManyResult } from '@/src/documents/collections/types';
import {
  DataAPIResponseError, CollectionDeleteManyError,
  CollectionInsertManyError,
  mkRespErrorFromResponse,
  mkRespErrorFromResponses, CollectionUpdateManyError, TableInsertManyError,
} from '@/src/documents/errors';
import { describe, it } from '@/tests/testlib';
import assert from 'assert';
import { TableInsertManyResult } from '@/src/documents';

describe('unit.documents.errors', () => {
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
      assert.strictEqual(err.message, raws[0].errors[0].message + ' (+ 1 more errors)');
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.name, 'DataAPIResponseError');
    });
  });

  describe('CollectionInsertManyError construction', () => {
    const partialResult: CollectionInsertManyResult<SomeDoc> = { insertedIds: ['1', '2'], insertedCount: 2 };

    it('should properly construct a single-response CollectionInsertManyError', () => {
      const err = mkRespErrorFromResponse(CollectionInsertManyError, commands[0], raws[0], <any>{ partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'CollectionInsertManyError');
    });

    it('should properly construct a multi-response CollectionInsertManyError', () => {
      const err = mkRespErrorFromResponses(CollectionInsertManyError, commands, raws, <any>{ partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message + ' (+ 1 more errors)');
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'CollectionInsertManyError');
    });
  });

  describe('TableInsertManyError construction', () => {
    const partialResult: TableInsertManyResult<SomeDoc> = { insertedIds: [{ key: '1' }, { key: '2' }], insertedCount: 2 };

    it('should properly construct a single-response TableInsertManyError', () => {
      const err = mkRespErrorFromResponse(TableInsertManyError, commands[0], raws[0], <any>{ partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.deepStrictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'TableInsertManyError');
    });

    it('should properly construct a multi-response TableInsertManyError', () => {
      const err = mkRespErrorFromResponses(TableInsertManyError, commands, raws, <any>{ partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message + ' (+ 1 more errors)');
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.deepStrictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'TableInsertManyError');
    });
  });

  describe('CollectionDeleteManyError construction', () => {
    const partialResult: CollectionDeleteManyResult = { deletedCount: 2 };

    it('should properly construct a single-response CollectionDeleteManyError', () => {
      const err = mkRespErrorFromResponse(CollectionDeleteManyError, commands[0], raws[0], { partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'CollectionDeleteManyError');
    });

    it('should properly construct a multi-response CollectionDeleteManyError', () => {
      const err = mkRespErrorFromResponses(CollectionDeleteManyError, commands, raws, { partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message + ' (+ 1 more errors)');
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'CollectionDeleteManyError');
    });
  });

  describe('CollectionUpdateManyError construction', () => {
    const partialResult: CollectionUpdateManyResult<SomeDoc> = { matchedCount: 2, modifiedCount: 2, upsertedCount: 0 };

    it('should properly construct a single-response CollectionUpdateManyError', () => {
      const err = mkRespErrorFromResponse(CollectionUpdateManyError, commands[0], raws[0], { partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message);
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'CollectionUpdateManyError');
    });

    it('should properly construct a multi-response CollectionUpdateManyError', () => {
      const err = mkRespErrorFromResponses(CollectionUpdateManyError, commands, raws, { partialResult });
      assert.strictEqual(err.message, raws[0].errors[0].message + ' (+ 1 more errors)');
      assert.deepStrictEqual(err.errorDescriptors, [descriptions[0], descriptions[1]]);
      assert.deepStrictEqual(err.detailedErrorDescriptors, [
        { command: commands[0], rawResponse: raws[0], errorDescriptors: [descriptions[0]] },
        { command: commands[1], rawResponse: raws[1], errorDescriptors: [descriptions[1]] },
      ]);
      assert.strictEqual(err.partialResult, partialResult);
      assert.strictEqual(err.name, 'CollectionUpdateManyError');
    });
  });
});
