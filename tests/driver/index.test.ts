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

import assert from 'assert';
import mongoose from 'mongoose';
import * as StargateMongooseDriver from '@/src/driver';
import { testClient } from '@/tests/fixtures';
import { logger } from '@/src/logger';
import { parseUri } from '@/src/collections/utils';

describe('Driver based tests', async () => {
    let dbUri: string;
    let isAstra: boolean;
    before(async function () {
        if (testClient == null) {
            return this.skip();
        }
        const astraClient = await testClient.client;
        if (astraClient === null) {
            logger.info('Skipping tests for client: %s', testClient);
            return this.skip();
        }
        dbUri = testClient.uri;
        isAstra = testClient.isAstra;
    });
    describe('StargateMongoose - index', () => {
        it('should leverage astradb', async function () {
            let Cart, Product;
            let astraMongoose, jsonAPIMongoose;
            try {
                const cartSchema = new mongoose.Schema({
                    name: String,
                    cartName: {type: String, lowercase: true, unique: true, index: true},
                    products: [{type: mongoose.Schema.Types.ObjectId, ref: 'Product'}]
                });

                const productSchema = new mongoose.Schema({
                    name: String,
                    price: Number,
                    expiryDate: Date,
                    isCertified: Boolean
                });
                if (isAstra) {
                    astraMongoose = new mongoose.Mongoose();
                    astraMongoose.setDriver(StargateMongooseDriver);
                    astraMongoose.set('autoCreate', true);
                    astraMongoose.set('autoIndex', false);
                    Cart = astraMongoose.model('Cart', cartSchema);
                    Product = astraMongoose.model('Product', productSchema);

                    // @ts-ignore - these are config options supported by stargate-mongoose but not mongoose
                    await astraMongoose.connect(dbUri, {isAstra: true});
                    await Promise.all(Object.values(astraMongoose.connection.models).map(Model => Model.init()));
                } else {
                    // @ts-ignore
                    jsonAPIMongoose = new mongoose.Mongoose();
                    jsonAPIMongoose.setDriver(StargateMongooseDriver);
                    jsonAPIMongoose.set('autoCreate', true);
                    jsonAPIMongoose.set('autoIndex', false);
                    Cart = jsonAPIMongoose.model('Cart', cartSchema);
                    Product = jsonAPIMongoose.model('Product', productSchema);

                    const options = {
                        username: process.env.STARGATE_USERNAME,
                        password: process.env.STARGATE_PASSWORD,
                        authUrl: process.env.STARGATE_AUTH_URL,
                        logSkippedOptions: true
                    };
                    // @ts-ignore - these are config options supported by stargate-mongoose but not mongoose
                    await jsonAPIMongoose.connect(dbUri, options);
                    await Promise.all(Object.values(jsonAPIMongoose.connection.models).map(Model => Model.init()));
                }
                await Promise.all([Product.deleteMany({}), Cart.deleteMany({})]);
                const product1 = new Product({
                    name: 'Product 1',
                    price: 10,
                    expiryDate: new Date('2024-04-20T00:00:00.000Z'),
                    isCertified: true
                });
                await product1.save();

                const product2 = new Product({
                    name: 'Product 2',
                    price: 10,
                    expiryDate: new Date('2024-11-20T00:00:00.000Z'),
                    isCertified: false
                });
                await product2.save();

                const cart = new Cart({
                    name: 'My Cart',
                    cartName: 'wewson',
                    products: [product1._id, product2._id]
                });
                await cart.save();
                assert.strictEqual(await Cart.findOne({cartName: 'wewson'}).select('name').exec().then((doc: any) => doc.name), cart.name);
                //compare if product expiryDate is same as saved
                assert.strictEqual(await Product.findOne({name: 'Product 1'}).select('expiryDate').exec().then((doc: any) => doc.expiryDate.toISOString()), product1.expiryDate!.toISOString());

                const findOneAndReplaceResp = await Cart.findOneAndReplace({cartName: 'wewson'}, {
                    name: 'My Cart 2',
                    cartName: 'wewson1'
                }, {returnDocument: 'after'}).exec();
                assert.strictEqual(findOneAndReplaceResp!.name, 'My Cart 2');
                assert.strictEqual(findOneAndReplaceResp!.cartName, 'wewson1');

                const productNames: string[] = [];
                const cursor = await Product.find().cursor();
                await cursor.eachAsync(p => productNames.push(p.name!));
                assert.deepEqual(productNames.sort(), ['Product 1', 'Product 2']);

                await cart.deleteOne();
                assert.strictEqual(await Cart.findOne({cartName: 'wewson'}), null);
            } finally {
                if (isAstra) {
                    astraMongoose?.connection.dropCollection('carts');
                    astraMongoose?.connection.dropCollection('products');
                } else {
                    jsonAPIMongoose?.connection.dropCollection('carts');
                    jsonAPIMongoose?.connection.dropCollection('products');
                }
            }
        });
    });
    describe('Mongoose API', () => {
        let mongooseInstance: mongoose.Mongoose | undefined;
        beforeEach(async function () {
            mongooseInstance = await createMongooseInstance();
        });
        afterEach(async function () {
            //add all unique collections here that are used across tests
            await mongooseInstance?.connection.dropCollection('people');
            await mongooseInstance?.connection.dropCollection('parents');
            await mongooseInstance?.connection.dropCollection('children');
            await mongooseInstance?.connection.dropCollection('grandchildren');
            await mongooseInstance?.connection.dropCollection('carts');
            await mongooseInstance?.connection.dropCollection('products');
        });
        it('handles find cursors', async () => {
            // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: { type: String, required: true }
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            await Person.create([{name: 'John'}, {name: 'Bill'}]);

            const names: string[] = [];
            const cursor = await Person.find().cursor();
            await cursor.eachAsync(doc => names.push(doc.name));
            assert.deepEqual(names.sort(), ['Bill', 'John']);
        });

        it('handles document deleteOne() and updateOne()', async () => {
            // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            const [person1] = await Person.create([{name: 'John'}, {name: 'Bill'}]);

            await person1.updateOne({name: 'Joe'});
            let names = await Person.find();
            assert.deepEqual(names.map(doc => doc.name).sort(), ['Bill', 'Joe']);

            await person1.deleteOne();
            names = await Person.find();
            assert.deepEqual(names.map(doc => doc.name).sort(), ['Bill']);
        });

        it('handles updating existing document with save()', async () => {
        // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            const [person] = await Person.create([{name: 'John'}]);

            person.name = 'Joe';
            await person.save();
            const names = await Person.find();
            assert.deepEqual(names.map(doc => doc.name).sort(), ['Joe']);
        });

        it('handles populate()', async () => {
            // @ts-ignore
            const cartSchema = new mongooseInstance.Schema({
                name: String,
                products: [{ type: 'ObjectId', ref: 'Product' }]
            });
            // @ts-ignore
            const productSchema = new mongooseInstance.Schema({
                name: String,
                price: Number
            });
            // @ts-ignore
            const Cart = mongooseInstance.model('Cart', cartSchema);
            // @ts-ignore
            const Product = mongooseInstance.model('Product', productSchema);
            await Promise.all([Cart.init(), Product.init()]);
            await Promise.all([Cart.deleteMany({}), Product.deleteMany({})]);
            const [{ _id: productId }] = await Product.create([
                { name: 'iPhone 12', price: 500 },
                { name: 'MacBook Air', price: 1400 }
            ]);
            const { _id: cartId } = await Cart.create({ name: 'test', products: [productId] });

            const cart = await Cart.findById(cartId).populate<{ products: (typeof Product)[] }>('products').orFail();
            assert.deepEqual(cart.products.map(p => p.name), ['iPhone 12']);
        });

        it('handles nested populate()', async () => {
            // @ts-ignore
            const parentSchema = new mongooseInstance.Schema({
                name: String,
                children: [{type: 'ObjectId', ref: 'Child'}]
            });
            // @ts-ignore
            const childSchema = new mongooseInstance.Schema({
                name: String,
                children: [{type: 'ObjectId', ref: 'Grandchild'}]
            });
            // @ts-ignore
            const grandchildSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Parent = mongooseInstance.model('Parent', parentSchema);
            // @ts-ignore
            const Child = mongooseInstance.model('Child', childSchema);
            // @ts-ignore
            const Grandchild = mongooseInstance.model('Grandchild', grandchildSchema);
            await Promise.all([Parent.init(), Child.init(), Grandchild.init()]);
            await Promise.all([Parent.deleteMany({}), Child.deleteMany({}), Grandchild.deleteMany({})]);
            const [{_id: grandchildId}] = await Grandchild.create([
                {name: 'Ben Skywalker'},
                {name: 'Jacen Solo'}
            ]);
            const [{_id: childId}] = await Child.create([
                {name: 'Luke Skywalker', children: [grandchildId]},
                {name: 'Han Solo'}
            ]);
            const {_id: parentId} = await Parent.create({
                name: 'Anakin Skywalker',
                children: [childId]
            });

      type PopulateTypeOverride = {
        children: { name?: string, children: (typeof Grandchild)[] }[]
      };
      const parent = await Parent
          .findById(parentId)
          .populate<PopulateTypeOverride>({
              path: 'children',
              populate: {path: 'children'}
          });
      assert.equal(parent!.children.length, 1);
      assert.equal(parent!.children[0]!.name, 'Luke Skywalker');
      assert.equal(parent!.children[0]!.children.length, 1);
      assert.equal(parent!.children[0]!.children[0].name, 'Ben Skywalker');
        });

        it('handles exists()', async () => {
            // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            await Person.create([{name: 'John'}]);

            assert.ok(await Person.exists({name: 'John'}));
            assert.ok(!(await Person.exists({name: 'James'})));
        });

        it('handles insertMany()', async () => {
            // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            await Person.insertMany([{ name: 'John' }, { name: 'Bill' }]);

            const docs = await Person.find();
            assert.deepEqual(docs.map(doc => doc.name).sort(), ['Bill', 'John']);
        });

        it('throws readable error on bulkWrite()', async () => {
            // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            await assert.rejects(
                Person.bulkWrite([{insertOne: {document: {name: 'John'}}}]),
                /bulkWrite\(\) Not Implemented/
            );
        });

        it('throws readable error on aggregate()', async () => {
            // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            // @ts-ignore
            await assert.rejects(
                Person.aggregate([{$match: {name: 'John'}}]),
                /aggregate\(\) Not Implemented/
            );
        });

        it('throws readable error on change stream', async () => {
            // @ts-ignore
            const personSchema = new mongooseInstance.Schema({
                name: String
            });
            // @ts-ignore
            const Person = mongooseInstance.model('Person', personSchema);
            await Person.init();
            await Person.deleteMany({});
            await assert.throws(
                () => Person.watch([{$match: {name: 'John'}}]),
                /watch\(\) Not Implemented/
            );
        });

        async function createMongooseInstance() {
            const mongooseInstance = new mongoose.Mongoose();
            mongooseInstance.setDriver(StargateMongooseDriver);
            mongooseInstance.set('autoCreate', true);
            mongooseInstance.set('autoIndex', false);

            const options = isAstra ? { isAstra: true } : { username: process.env.STARGATE_USERNAME, password: process.env.STARGATE_PASSWORD, authUrl: process.env.STARGATE_AUTH_URL };
            // @ts-ignore - these are config options supported by stargate-mongoose but not mongoose
            await mongooseInstance.connect(dbUri, options);

            return mongooseInstance;
        }
    });
    describe('namespace management tests', () => {
        it('should fail when dropDatabase is called for AstraDB', async () => {
            const mongooseInstance = new mongoose.Mongoose();
            mongooseInstance.setDriver(StargateMongooseDriver);
            mongooseInstance.set('autoCreate', true);
            mongooseInstance.set('autoIndex', false);
            const options = isAstra ? { isAstra: true } : { username: process.env.STARGATE_USERNAME, password: process.env.STARGATE_PASSWORD, authUrl: process.env.STARGATE_AUTH_URL };
            // @ts-ignore - these are config options supported by stargate-mongoose but not mongoose
            await mongooseInstance.connect(dbUri, options);
            if (isAstra) {
                let error: any;
                try {
                    await mongooseInstance.connection.dropDatabase();
                } catch (e: any) {
                    error = e;
                }
                assert.strictEqual(error.message, 'Cannot drop database in Astra. Please use the Astra UI to drop the database.');
            } else {
                const connection: StargateMongooseDriver.Connection = mongooseInstance.connection as unknown as StargateMongooseDriver.Connection;
                const resp = await connection.dropDatabase();
                assert.strictEqual(resp.status?.ok, 1);
            }
        });
        it('should createDatabase if not exists in createCollection call for non-AstraDB', async () => {
            const mongooseInstance = new mongoose.Mongoose();
            mongooseInstance.setDriver(StargateMongooseDriver);
            mongooseInstance.set('autoCreate', true);
            mongooseInstance.set('autoIndex', false);
            const options = isAstra ? { isAstra: true } : { username: process.env.STARGATE_USERNAME, password: process.env.STARGATE_PASSWORD, authUrl: process.env.STARGATE_AUTH_URL };
            //split dbUri by / and replace last element with newKeyspaceName
            const dbUriSplit = dbUri.split('/');
            const token = parseUri(dbUri).applicationToken;
            const newKeyspaceName = 'new_keyspace';
            dbUriSplit[dbUriSplit.length - 1] = newKeyspaceName;
            let newDbUri = dbUriSplit.join('/');
            //if token is not null, append it to the new dbUri
            newDbUri = token ? newDbUri + '?applicationToken=' + token : newDbUri;
            // @ts-ignore - these are config options supported by stargate-mongoose but not mongoose
            await mongooseInstance.connect(newDbUri, options);
            if (isAstra) {
                let error: any;
                try {
                    await mongooseInstance.connection.createCollection('new_collection');
                } catch (e: any) {
                    error = e;
                }
                assert.strictEqual(error.errors[0].message, 'INVALID_ARGUMENT: Unknown keyspace ' + newKeyspaceName);
            } else {
                const connection: StargateMongooseDriver.Connection = mongooseInstance.connection as unknown as StargateMongooseDriver.Connection;
                const resp = await connection.createCollection('new_collection');
                assert.strictEqual(resp.status?.ok, 1);
            }
        });
    });
});
