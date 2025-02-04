import { Camel2SnakeCase, Db } from '@datastax/astra-db-ts';

export async function CollKeyTransformerExample(name: string, db: Db) {
  // As far as the client is concerned, the keys in the document are in camelCase
  // _id is an exception to the rule, and will always be in snake_case (unless exceptId: false in Camel2SnakeCase options)
  interface CollSchema {
    _id: string,
    fullName: string,
    roughAddress: {
      galaxyName: string,
      planetName: string,
    },
  }

  // transformNested needs to explicitly be set to true to transform nested keys
  // A function may be passed to transformNested for more granular control over which objects are recursively transformed
  const coll = await db.createCollection<CollSchema>(name, {
    serdes: {
      keyTransformer: new Camel2SnakeCase({ transformNested: true }),
    },
  });

  // Insert & find the document using camelCase keys
  await coll.insertOne({
    _id: 'alice123',
    fullName: 'Alice W. Land',
    roughAddress: {
      galaxyName: 'Milky Way',
      planetName: 'Trantor',
    },
  });

  // { _id: 'alice123', fullName: 'Alice W. Land', roughAddress: { galaxyName: 'Milky Way', planetName: 'Trantor' } }
  const found = await coll.findOne({ 'roughAddress.planetName': 'Trantor' });
  console.log('Found document in camelCase', found);

  // However, if we try accessing the same document through a collection without a key transformer,
  // we'll need to use explicit snake_case keys
  const collRaw = db.collection(name);

  // { _id: 'alice123', full_name: 'Alice W. Land', rough_address: { galaxy_name: 'Milky Way', planet_name: 'Trantor' } }
  const foundRaw = await collRaw.findOne({ 'rough_address.planet_name': 'Trantor' });
  console.log('Found document in raw snake_case', foundRaw);
}
