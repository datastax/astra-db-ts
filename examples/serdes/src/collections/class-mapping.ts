import { CollCodecs, Db, SomeDoc } from '@datastax/astra-db-ts';

class Book {
  constructor(public title: string, public author: Author, public isbn: string) {}
}

class Author {
  constructor(public fullName: string, public birthdate: Date) {}
}

export async function CollectionClassMappingExample(name: string, db: Db) {
  const coll = await db.createCollection<Book>(name, {
    serdes: {
      mutateInPlace: true,
      codecs: [BookCodec],
    },
  });

  // Insert some documents
  const author = new Author('Realm, Aether', new Date('2000-01-01'));

  const inserted = await coll.insertMany([
    new Book('The Sun, The Moon, The Star', author, '123-4-567-89012-3'),
    new Book('The Fool', author, '098-7-654-32109-8'),
  ]);
  console.log(inserted);

  // Find a document
  const found = await coll.findOne({ isbn: '123-4-567-89012-3' });
  console.dir(found, { depth: null });
}

const BookCodec = CollCodecs.forPath([], {
  serialize: (_, value: unknown, ctx) => {
    if (!(value instanceof Book)) {
      if (value && typeof value === 'object' && 'isbn' in value) {
        return ctx.recurse({ ...value, _id: value.isbn, isbn: undefined });
      }
      return ctx.continue();
    }

    return ctx.done({
      _id: value.isbn,
      title: value.title,
      author: {
        firstName: value.author.fullName.split(', ')[1],
        lastName: value.author.fullName.split(', ')[0],
        birthdate: value.author.birthdate.toISOString(),
      },
    })
  },
  deserializeGuard(_, ctx) {
    return !ctx.parsingInsertedId;
  },
  deserialize: (_, value: SomeDoc, ctx) => {
    const book = new Book(
      value.title,
      new Author(`${value.author.lastName}, ${value.author.firstName}`, new Date(value.author.birthdate)),
      value._id,
    );
    return ctx.done(book);
  },
});
