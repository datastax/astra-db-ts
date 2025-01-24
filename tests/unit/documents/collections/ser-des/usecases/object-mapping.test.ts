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

import { describe, it } from '@/tests/testlib';
import { Camel2SnakeCase, CollCodecs } from '@/src/index';
import BigNumber from 'bignumber.js';
import { CollectionSerDes } from '@/src/documents/collections/ser-des/ser-des';
import assert from 'assert';

describe('unit.documents.collections.ser-des.usecases.object-mapping', () => {
  class Book {
    constructor(
      readonly title: string,
      readonly author: Author,
      readonly isbn: string,
      readonly price: BigNumber,
      readonly publishedAt: Date,
    ) {}

    public get numPages() {
      return 'how would I know??';
    }

    public prettyPrint() {
      return 'no';
    }
  }

  class Author {
    private hairColor = { $date: 'my hair color just coincidentally happens to look like a serialized Date' };

    constructor(
      readonly name: string,
    ) {}
  }

  it('should work with explicit serdes', () => {
    const BookCodec = CollCodecs.forPath([], {
      serialize: (_, value, ctx) => {
        if (!(value instanceof Book)) {
          return ctx.nevermind();
        }

        return ctx.continue({
          _id: value.isbn,
          title: value.title,
          author: value.author.name,
          price: value.price,
          publishedAt: value.publishedAt,
          $vectorize: value.title,
        });
      },
      deserialize: (_, value, ctx) => {
        if (ctx.parsingInsertedId || !value) {
          return ctx.nevermind();
        }

        ctx.postMap((_, value) => new Book(
          value.title,
          new Author(value.author),
          value._id,
          value.price,
          value.publishedAt,
        ));

        return ctx.continue();
      },
    });

    const serdes = new CollectionSerDes({
      enableBigNumbers: () => 'bignumber',
      keyTransformer: new Camel2SnakeCase(),
      codecs: [BookCodec],
    });

    const book = new Book(
      'Lord of the Fries',
      new Author('Gilliam Wolding'),
      'what_does_an_isbn_even_look_like',
      BigNumber(-12.50),
      new Date('2026-01-01'),
    );

    const serialized = {
      _id: 'what_does_an_isbn_even_look_like',
      title: 'Lord of the Fries',
      author: 'Gilliam Wolding',
      price: BigNumber(-12.50),
      published_at: { '$date': 1767225600000 },
      $vectorize: 'Lord of the Fries',
    };

    assert.deepStrictEqual(serdes.serialize(book), [serialized, true]);
    assert.deepStrictEqual(serdes.deserialize(serialized, {}), book);
  });
});
