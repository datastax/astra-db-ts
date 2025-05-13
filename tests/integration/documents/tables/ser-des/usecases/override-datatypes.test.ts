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

import { Cfg, it, parallel } from '@/tests/testlib/index.js';
import { blob, TableCodecs, uuid } from '@/src/index.js';
import assert from 'assert';

parallel('integration.documents.tables.ser-des.usecases.override-datatypes', ({ db }) => {
  it('should allow you to override scalar types', async (key) => {
    const BufferCodec = TableCodecs.forType('blob', {
      serializeClass: Buffer,
      serialize: (buffer: Buffer, ctx) => {
        return ctx.replace(blob(buffer));
      },
      deserialize: (raw, ctx) => {
        return ctx.done(blob(raw).asBuffer());
      },
    });

    const table = db.table(Cfg.DefaultTableName, {
      serdes: { codecs: [BufferCodec], sparseData: true },
    });

    const buffer = Buffer.from('hello');

    await table.insertOne({ text: key, int: 0, blob: buffer });
    const result = await table.findOne({ text: key });

    assert.deepStrictEqual(result, { text: key, int: 0, blob: buffer });
  });

  it('should allow you to override nested types', async (key) => {
    const MapCodec = TableCodecs.forType('map', {
      deserialize: (raw, ctx) => {
        return ctx.recurse(raw);
      },
    });

    const table = db.table(Cfg.DefaultTableName, {
      serdes: { codecs: [MapCodec], sparseData: true },
    });

    const id = uuid.v4();

    await table.insertOne({ text: key, int: 0, map: { a: id } });
    const result = await table.findOne({ text: key });

    assert.deepStrictEqual(result, { text: key, int: 0, map: { a: id } });
  });
});
