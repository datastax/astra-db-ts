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

import { Cfg, initTestObjects, it, parallel } from '@/tests/testlib/index.js';
import type { CollectionCodec, CollectionDesCtx, CollectionSerCtx, CommandSucceededEvent } from '@/src/index.js';
import { $DeserializeForCollection, $SerializeForCollection, CollectionCodecs } from '@/src/index.js';
import { BigNumber } from 'bignumber.js';
import assert from 'assert';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';

parallel('integration.documents.collections.ser-des.usecases.object-mapping', () => {
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

    // const ISBNCodec = CollectionCodecs.forId(CollectionCodecs.asCodecClass(ISBN, (clazz) => {
    //   clazz.prototype[$SerializeForCollection] = function (ctx: CollectionSerCtx) {
    //     return ctx.done(this.unwrap);
    //   };
    //   clazz[$DeserializeForCollection] = function (raw: string, ctx: CollectionDesCtx) {
    //     return ctx.done(new ISBN(raw));
    //   };
    // }));

    const ISBNCodec = CollectionCodecs.forId(CollectionCodecs.asCodecClass(ISBN, {
      serializeForCollection(ctx) {
        return ctx.done(this.unwrap);
      },
      deserializeForCollection(raw, ctx) {
        return ctx.done(new ISBN(raw));
      },
    }));

    const BookCodec = CollectionCodecs.forPath([], {
      serialize: (book, ctx) => {
        if (!(book instanceof Book)) {
          return ctx.nevermind();
        }

        return ctx.recurse({
          _id: book.isbn,
          title: book.title,
          author: book.author.name,
          price: book.price,
          publishedAt: book.publishedAt,
          insertedAt: new Date('3000-01-01'),
          reviews: book.reviews,
        });
      },
      deserialize: (_, ctx) => {
        if (ctx.target !== SerDesTarget.Record) {
          return ctx.nevermind();
        }

        ctx.mapAfter((book) => new Book(
          book.title,
          new Person(book.author),
          book._id,
          book.price,
          book.publishedAt,
          book.reviews,
        ));

        return ctx.recurse();
      },
    });

    const SetCodec = CollectionCodecs.forPath(['reviews'], {
      serialize(value: Set<Review>, ctx) {
        return ctx.recurse([...value]);
      },
      deserialize(_, ctx) {
        ctx.mapAfter((v) => new Set(v));
        return ctx.recurse();
      },
    });

    const ReviewCodec = CollectionCodecs.forPath(['reviews', '*'], {
      serialize: (review, ctx) => {
        return ctx.done({ criticName: review.critic.name, review: review.review });
      },
      deserialize: (raw, ctx) => {
        return ctx.done(new Review(new Person(raw.criticName), raw.review));
      },
    });

    const coll = db.collection(Cfg.DefaultCollectionName, {
      serdes: {
        enableBigNumbers: () => 'bignumber',
        codecs: [ISBNCodec, BookCodec, SetCodec, ReviewCodec],
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
      _id: `what_does_an_isbn_even_look_like_${key}`,
      title: 'Lord of the Fries',
      author: 'Gilliam Wolding',
      price: BigNumber(-12.50),
      publishedAt: { '$date': 0 },
      insertedAt: { '$date': 32503680000000 },
      reviews: [{ criticName: 'Tow Mater', review: 'dad gum!' }],
    };

    let cse!: CommandSucceededEvent;
    client.on('commandSucceeded', (e) => cse = e);

    const { insertedId } = await coll.insertOne(book);
    assert.deepStrictEqual(cse.command.insertOne.document, serialized);
    assert.deepStrictEqual(cse.response.status?.insertedIds, [book.isbn.unwrap]);
    assert.deepStrictEqual(insertedId, book.isbn);

    const found = await coll.findOne({ _id: book.isbn });
    assert.deepStrictEqual(found, book);
  });

  it('should work with delegate serdes', async (key) => {
    class Book implements CollectionCodec<typeof Book> {
      constructor(
        readonly title: string,
        readonly author: Person,
        readonly isbn: ISBN,
        readonly price: BigNumber,
        readonly publishedAt: Date,
        readonly reviews: MySet<Review>,
      ) {}

      static [$DeserializeForCollection](value: unknown, ctx: CollectionDesCtx) {
        if (ctx.target !== SerDesTarget.Record) {
          return ctx.nevermind();
        }

        ctx.mapAfter((book) => new Book(
          book.title,
          new Person(book.author),
          book._id,
          book.price,
          book.publishedAt,
          book.reviews,
        ));

        return ctx.recurse();
      };

      [$SerializeForCollection](ctx: CollectionSerCtx) {
        return ctx.recurse({
          _id: book.isbn,
          title: book.title,
          author: book.author.name,
          price: book.price,
          publishedAt: book.publishedAt,
          insertedAt: new Date('3000-01-01'),
          reviews: book.reviews,
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

    class ISBN implements CollectionCodec<typeof ISBN> {
      constructor(readonly unwrap: string) {}

      static [$DeserializeForCollection](raw: string, ctx: CollectionDesCtx) {
        return ctx.done(new ISBN(raw));
      }

      [$SerializeForCollection](ctx: CollectionSerCtx) {
        return ctx.done(this.unwrap);
      }
    }

    class Review implements CollectionCodec<typeof Review> {
      constructor(readonly critic: Person, readonly review: string) {}

      static [$DeserializeForCollection](raw: any, ctx: CollectionDesCtx) {
        return ctx.done(new Review(new Person(raw.criticName), raw.review));
      }

      [$SerializeForCollection](ctx: CollectionSerCtx) {
        return ctx.done({ criticName: this.critic.name, review: this.review });
      }
    }

    class MySet<T> extends Set<T> implements CollectionCodec<typeof MySet> {
      static [$DeserializeForCollection](_: unknown, ctx: CollectionDesCtx) {
        ctx.mapAfter((v) => new MySet(v));
        return ctx.recurse();
      }

      [$SerializeForCollection](ctx: CollectionSerCtx) {
        return ctx.recurse([...this]);
      }
    }

    const { client, db } = initTestObjects();

    const coll = db.collection(Cfg.DefaultCollectionName, {
      serdes: {
        enableBigNumbers: () => 'bignumber',
        codecs: [
          CollectionCodecs.forId(ISBN),
          CollectionCodecs.forPath([], Book),
          CollectionCodecs.forPath(['reviews'], MySet),
          CollectionCodecs.forPath(['reviews', '*'], Review),
        ],
      },
    });

    const book = new Book(
      'Lord of the Fries',
      new Person('Gilliam Wolding'),
      new ISBN(`what_does_an_isbn_even_look_like_${key}`),
      BigNumber(-12.50),
      new Date('1970-01-01'),
      new MySet([
        new Review(new Person('Tow Mater'), 'dad gum!'),
      ]),
    );

    const serialized = {
      _id: `what_does_an_isbn_even_look_like_${key}`,
      title: 'Lord of the Fries',
      author: 'Gilliam Wolding',
      price: BigNumber(-12.50),
      publishedAt: { '$date': 0 },
      insertedAt: { '$date': 32503680000000 },
      reviews: [{ criticName: 'Tow Mater', review: 'dad gum!' }],
    };

    let cse!: CommandSucceededEvent;
    client.on('commandSucceeded', (e) => cse = e);

    const { insertedId } = await coll.insertOne(book);
    assert.deepStrictEqual(cse.command.insertOne.document, serialized);
    assert.deepStrictEqual(cse.response.status?.insertedIds, [book.isbn.unwrap]);
    assert.deepStrictEqual(insertedId, book.isbn);

    const found = await coll.findOne({ _id: book.isbn });
    assert.deepStrictEqual(found, book);
  });
});
