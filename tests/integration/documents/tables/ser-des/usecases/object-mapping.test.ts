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

import { initTestObjects, it, parallel } from '@/tests/testlib';
import type {
  CommandSucceededEvent,
  TableCodec,
  TableDesCtx,
  TableSerCtx} from '@/src/index';
import {
  $DeserializeForTable,
  $SerializeForTable,
  Camel2SnakeCase,
  TableCodecs,
} from '@/src/index';
import { BigNumber } from 'bignumber.js';
import assert from 'assert';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx';

parallel('integration.documents.tables.ser-des.usecases.object-mapping', { drop: 'tables:after' }, ({ db }) => {
  before(async () => {
    await db.createTable('obj_mapping_table', {
      definition: {
        columns: {
          isbn: { type: 'text' },
          title: { type: 'text' },
          author: { type: 'text' },
          price: { type: 'decimal' },
          published_at: { type: 'timestamp' },
          inserted_at: { type: 'timestamp' },
          review_names: { type: 'list', valueType: 'text' },
          review_reviews: { type: 'list', valueType: 'text' },
        },
        primaryKey: 'isbn',
      },
      ifNotExists: true,
    });
  });

  it('should work with explicit serdes', async (key) => {
    class Book {
      constructor(
        readonly title: string,
        readonly author: Person,
        readonly isbn: ISBN,
        readonly price: BigNumber,
        readonly publishedAt: Date,
        readonly reviews: Set<Review>,
      ) {}

      public get numPages() {
        return 'how would I know??'.length;
      }

      public prettyPrint() {
        return 'no';
      }
    }

    class Person {
      private hairColor = { $date: 'my hair color just coincidentally happens to look like a serialized Date' };
      constructor(readonly name: string) {}
    }

    class ISBN {
      constructor(readonly unwrap: string) {}
    }

    class Review {
      constructor(readonly critic: Person, readonly review: string) {}
    }

    const { client, db } = initTestObjects();

    const ISBNCodec = TableCodecs.forPath(['isbn'], {
      serialize: (isbn, ctx) => ctx.done(isbn.unwrap),
      deserialize: (raw, ctx) => ctx.done(new ISBN(raw)),
    });

    const BookCodec = TableCodecs.forPath([], {
      serialize: (book, ctx) => {
        if (!(book instanceof Book)) {
          return ctx.nevermind();
        }

        return ctx.replace({
          isbn: book.isbn,
          title: book.title,
          author: book.author.name,
          price: book.price,
          publishedAt: book.publishedAt,
          insertedAt: new Date('3000-01-01'),
          reviewNames: [...book.reviews].map((r) => r.critic.name),
          reviewReviews: [...book.reviews].map((r) => r.review),
        });
      },
      deserialize: (_, ctx) => {
        if (ctx.target !== SerDesTarget.Record) {
          return ctx.nevermind();
        }

        return ctx.mapAfter((book) => {
          const reviews = book.reviewNames.map((name: string, i: number) => new Review(new Person(name), book.reviewReviews[i]));

          return new Book(
            book.title,
            new Person(book.author),
            book.isbn,
            book.price,
            book.publishedAt,
            new Set(reviews),
          );
        });
      },
    });

    const table = db.table('obj_mapping_table', {
      serdes: {
        keyTransformer: new Camel2SnakeCase(),
        codecs: [ISBNCodec, BookCodec],
      },
    });

    const book = new Book(
      'Lord of the Fries',
      new Person('Gilliam Wolding'),
      new ISBN(`what_does_an_isbn_even_look_like_${key}`),
      BigNumber(-12.50),
      new Date('1970-01-01'),
      new Set([
        new Review(new Person('Tow Mater'), 'dad gum!'),
      ]),
    );

    const serialized = {
      isbn: `what_does_an_isbn_even_look_like_${key}`,
      title: 'Lord of the Fries',
      author: 'Gilliam Wolding',
      price: BigNumber(-12.50),
      published_at: '1970-01-01T00:00:00.000Z',
      inserted_at: '3000-01-01T00:00:00.000Z',
      review_names: ['Tow Mater'],
      review_reviews: ['dad gum!'],
    };

    let cse!: CommandSucceededEvent;
    client.on('commandSucceeded', (e) => cse = e);

    const { insertedId } = await table.insertOne(book);
    assert.deepStrictEqual(cse.command.insertOne.document, serialized);
    assert.deepStrictEqual(cse.resp.status?.insertedIds, [[book.isbn.unwrap]]);
    assert.deepStrictEqual(insertedId, { isbn: book.isbn });

    const found = await table.findOne({ isbn: book.isbn });
    assert.deepStrictEqual(found, book);
  });

  it('should work with delegate serdes', async (key) => {
    class Book implements TableCodec<typeof Book> {
      constructor(
        readonly title: string,
        readonly author: Person,
        readonly isbn: ISBN,
        readonly price: BigNumber,
        readonly publishedAt: Date,
        readonly reviews: Set<Review>,
      ) {}

      static [$DeserializeForTable](value: unknown, ctx: TableDesCtx) {
        if (ctx.target !== SerDesTarget.Record) {
          return ctx.nevermind();
        }

        ctx.mapAfter((book) => new Book(
          book.title,
          new Person(book.author),
          book.isbn,
          book.price,
          book.publishedAt,
          new Set(book.reviewNames.map((name: string, i: number) => new Review(new Person(name), book.reviewReviews[i]))),
        ));

        return ctx.recurse();
      };

      [$SerializeForTable](ctx: TableSerCtx) {
        return ctx.recurse({
          isbn: book.isbn,
          title: book.title,
          author: book.author.name,
          price: book.price,
          publishedAt: book.publishedAt,
          insertedAt: new Date('3000-01-01'),
          reviewNames: [...book.reviews].map((r) => r.critic.name),
          reviewReviews: [...book.reviews].map((r) => r.review),
        });
      }

      public get numPages() {
        return 'how would I know??'.length;
      }

      public prettyPrint() {
        return 'no';
      }
    }

    class Person {
      private hairColor = { $date: 'my hair color just coincidentally happens to look like a serialized Date' };
      constructor(readonly name: string) {}
    }

    class ISBN implements TableCodec<typeof ISBN> {
      constructor(readonly unwrap: string) {}

      static [$DeserializeForTable](raw: string, ctx: TableDesCtx) {
        return ctx.done(new ISBN(raw));
      }

      [$SerializeForTable](ctx: TableSerCtx) {
        return ctx.done(this.unwrap);
      }
    }

    class Review {
      constructor(readonly critic: Person, readonly review: string) {}
    }

    const { client, db } = initTestObjects();

    const table = db.table('obj_mapping_table', {
      serdes: {
        keyTransformer: new Camel2SnakeCase({ transformNested: true }),
        codecs: [
          TableCodecs.forName('', Book),
          TableCodecs.forName('isbn', ISBN),
        ],
      },
    });

    const book = new Book(
      'Lord of the Fries',
      new Person('Gilliam Wolding'),
      new ISBN(`what_does_an_isbn_even_look_like_${key}`),
      BigNumber(-12.50),
      new Date('1970-01-01'),
      new Set([
        new Review(new Person('Tow Mater'), 'dad gum!'),
      ]),
    );

    const serialized = {
      isbn: `what_does_an_isbn_even_look_like_${key}`,
      title: 'Lord of the Fries',
      author: 'Gilliam Wolding',
      price: BigNumber(-12.50),
      published_at: '1970-01-01T00:00:00.000Z',
      inserted_at: '3000-01-01T00:00:00.000Z',
      review_names: ['Tow Mater'],
      review_reviews: ['dad gum!'],
    };

    let cse!: CommandSucceededEvent;
    client.on('commandSucceeded', (e) => cse = e);

    const { insertedId } = await table.insertOne(book);
    assert.deepStrictEqual(cse.command.insertOne.document, serialized);
    assert.deepStrictEqual(cse.resp.status?.insertedIds, [[book.isbn.unwrap]]);
    assert.deepStrictEqual(insertedId, { isbn: book.isbn });

    const found = await table.findOne({ isbn: book.isbn });
    assert.deepStrictEqual(found, book);
  });
});
