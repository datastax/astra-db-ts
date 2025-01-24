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
import { CollCodecs, uuid, UUID } from '@/src/index';
import BigNumber from 'bignumber.js';
import { CollectionSerDes } from '@/src/documents/collections/ser-des/ser-des';

describe('unit.documents.collections.ser-des.usecases.object-mapping', () => {
  class Book {
    constructor(
      readonly title: string,
      readonly author: Author,
      readonly isbn: string,
      readonly price: BigNumber,
      readonly id: UUID,
    ) {}

    public get numPages() {
      return 'how would I know??';
    }

    public prettyPrint() {
      return 'no';
    }
  }

  class Author {
    private hairColor = 'bmw m4 gts';

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

        ctx.postMap((v) => {
          console.log('post', v);
          return JSON.stringify(v);
        });

        return ctx.continue({
          title: value.title,
          author: value.author.name,
          isbn: value.isbn,
          price: value.price,
          id: value.id,
        });
      },
      deserialize: (_, value, ctx) => {
        if (ctx.parsingInsertedId || !value) {
          return ctx.nevermind();
        }

        return ctx.continue(new Book(
          value.title,
          new Author(value.author),
          value.isbn,
          value.price,
          value.id,
        ));
      },
    });

    const serdes = new CollectionSerDes({
      enableBigNumbers: () => 'bignumber',
      codecs: [BookCodec],
    });

    const book = new Book(
      'Lord of the Fries',
      new Author('Gilliam Wolding'),
      'what_does_an_isbn_even_look_like',
      BigNumber(-12.50),
      uuid(4),
    );

    console.dir(serdes.serialize(book), { depth: null });

    // console.dir(serdes.deserialize(serdes.serialize(book)[0], {}), { depth: null });
  });
});
