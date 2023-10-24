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
import { Db } from '@/src/collections/db';
import { Client } from '@/src/collections/client';
import { testClient, TEST_COLLECTION_NAME } from '@/tests/fixtures';
import mongoose from 'mongoose';
import * as StargateMongooseDriver from '@/src/driver';

describe('Options tests', async () => {
    let astraClient: Client | null;
    let db: Db;
    let dbUri: string;
    let isAstra: boolean;
    let Product:mongoose.Model<any>, astraMongoose:mongoose.Mongoose | undefined, jsonAPIMongoose:mongoose.Mongoose | undefined;
    before(async function () {
        if (testClient == null) {
            return this.skip();
        }
        astraClient = await testClient?.client;
        if (astraClient === null) {
            return this.skip();
        }

        db = astraClient.db();
        await db.dropCollection(TEST_COLLECTION_NAME);
        dbUri = testClient.uri;
        isAstra = testClient.isAstra;
    });

    beforeEach(async function () {
        ({ Product, astraMongoose, jsonAPIMongoose } = await createClientsAndModels(isAstra));
    });

    afterEach(async function () {
        await dropCollections(isAstra, astraMongoose, jsonAPIMongoose, 'products');
    });

    async function createClientsAndModels(isAstra: boolean) {
        let Product, astraMongoose, jsonAPIMongoose;
        const productSchema = new mongoose.Schema({
            name: String,
            price: Number,
            expiryDate: Date,
            isCertified: Boolean,
            category: String
        });
        if(isAstra){
            astraMongoose = new mongoose.Mongoose();
            astraMongoose.setDriver(StargateMongooseDriver);
            astraMongoose.set('autoCreate', true);
            astraMongoose.set('autoIndex', false);
            Product = astraMongoose.model('Product', productSchema);
            // @ts-ignore - these are config options supported by stargate-mongoose but not mongoose
            await astraMongoose.connect(dbUri, { isAstra: true, logSkippedOptions: true });
            await Promise.all(Object.values(astraMongoose.connection.models).map(Model => Model.init()));
        } else{
            // @ts-ignore
            jsonAPIMongoose = new mongoose.Mongoose();
            jsonAPIMongoose.setDriver(StargateMongooseDriver);
            jsonAPIMongoose.set('autoCreate', true);
            jsonAPIMongoose.set('autoIndex', false);
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
        return { Product, astraMongoose, jsonAPIMongoose };
    }

    async function dropCollections(isAstra: boolean, astraMongoose: mongoose.Mongoose | undefined, jsonAPIMongoose: mongoose.Mongoose | undefined, collectionName: string) {
        if (isAstra) {
            await astraMongoose?.connection.dropCollection(collectionName);
        } else {
            await jsonAPIMongoose?.connection.dropCollection(collectionName);
        }
    }

    describe('options cleanup tests', () => {
        it('should cleanup insertManyOptions', async () => {
            // @ts-ignore
            const products: Product[] = [new Product({ name: 'Product 2', price: 10, isCertified: true }), new Product({ name: 'Product 1', price: 10, isCertified: false})];
            //rawResult options should be cleaned up by stargate-mongoose, but 'ordered' should be preserved
            const insertManyResp = await Product.insertMany(products, { ordered: true, rawResult: false });
            assert.strictEqual(insertManyResp.length, 2);
            assert.strictEqual(insertManyResp[0].name, 'Product 2');
            assert.strictEqual(insertManyResp[1].name, 'Product 1');
            //check if products are inserted
            const productsSaved = await Product.find({});
            assert.strictEqual(productsSaved.length, 2);
            //check if product name is one of the inserted products names
            const productNames:Set<string> = new Set<string>();
            products.map(product => product.name!).forEach(name => productNames.add(name));
            assert.ok(productNames.has(productsSaved[0].name!));
            productNames.delete(productsSaved[0].name!);
            assert.ok(productNames.has(productsSaved[1].name!));
            productNames.delete(productsSaved[1].name!);
            assert.strictEqual(productNames.size, 0);
        });
        it('should cleanup updateOneOptions', async () => {
            // @ts-ignore
            const products: Product[] = [new Product({ name: 'Product 2', price: 10, isCertified: true }),
                new Product({ name: 'Product 1', price: 10, isCertified: false }),
                new Product({ name: 'Product 3', price: 10, isCertified: true })];
            const insertManyResp = await Product.insertMany(products, { ordered: true, rawResult: false });
            assert.strictEqual(insertManyResp.length, 3);
            assert.strictEqual(insertManyResp[0].name, 'Product 2');
            assert.strictEqual(insertManyResp[1].name, 'Product 1');
            assert.strictEqual(insertManyResp[2].name, 'Product 3');
            //rawResult options should be cleaned up by stargate-mongoose, but 'upsert' should be preserved
            const updateOneResp = await Product.updateOne({ name: 'Product 4' },
                { $set : { isCertified : true }, $inc: { price: 5 } },
                { upsert: true, rawResult: false, sort: { name : 1 } }
            );
            assert.ok(updateOneResp.acknowledged);
            assert.strictEqual(updateOneResp.matchedCount, 0);
            assert.strictEqual(updateOneResp.modifiedCount, 0);
            assert.strictEqual(updateOneResp.upsertedCount, 1);
            assert.ok(updateOneResp.upsertedId);
            //find product 4
            const product4 = await Product.findOne({ name : 'Product 4' });
            assert.strictEqual(product4?.name, 'Product 4');
            assert.strictEqual(product4?.price, 5);
            assert.strictEqual(product4?.isCertified, true);
        });
        it('should cleanup updateManyOptions', async () => {
            // @ts-ignore
            const products: Product[] = [new Product({ name: 'Product 2', price: 10, isCertified: true, category: 'cat1' }), new Product({ name: 'Product 1', price: 10, isCertified: false, category: 'cat1' }), new Product({ name: 'Product 3', price: 10, isCertified: false, category: 'cat2' })];
            const insertManyResp = await Product.insertMany(products, { ordered: true, rawResult: false });
            assert.strictEqual(insertManyResp.length, 3);
            assert.strictEqual(insertManyResp[0].name, 'Product 2');
            assert.strictEqual(insertManyResp[1].name, 'Product 1');
            assert.strictEqual(insertManyResp[2].name, 'Product 3');
            //rawResult options should be cleaned up by stargate-mongoose, but 'upsert' should be preserved
            const updateManyResp = await Product.updateMany({ category: 'cat1' },
                { $set : { isCertified : true }, $inc: { price: 5 } },
                { upsert: true, rawResult: false, sort: { name : 1 } }
            );
            assert.ok(updateManyResp.acknowledged);
            assert.strictEqual(updateManyResp.matchedCount, 2);
            assert.strictEqual(updateManyResp.modifiedCount, 2);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            //find product 4
            const cat1Products = await Product.find({ category : 'cat1' });
            assert.strictEqual(cat1Products.length, 2);
            cat1Products.forEach(product => {
                assert.strictEqual(product.price, 15);
                assert.strictEqual(product.isCertified, true);
            });
        });
        it('should cleanup deleteOneOptions', async () => {
            // @ts-ignore
            const product1 = new Product({ name: 'Product 1', price: 10, isCertified: true });
            await product1.save();
            //runValidations is not a flag supported by JSON API, so it should be removed by stargate-mongoose
            await Product.deleteOne({ name: 'Product 1' }, { runValidations: true });
            const product1Deleted = await Product.findOne({ name: 'Product 1' });
            assert.strictEqual(product1Deleted, null);
        });
        it('should cleanup findOptions', async () => {
            //create 20 products using Array with id suffixed to prduct name
            // @ts-ignore
            let products: Product[] = [];
            for (let i = 0; i < 20; i++) {
                // @ts-ignore
                products.push(new Product({ name: `Product ${i}`, price: 10, isCertified: true }));
            }
            await Product.insertMany(products, { ordered: true, rawResult: false });
            //insert next 20 products using Array with id suffixed to product name
            // @ts-ignore
            products = [];
            for (let i = 20; i < 40; i++) {
                // @ts-ignore
                products.push(new Product({ name: `Product ${i}`, price: 10, isCertified: true }));
            }
            await Product.insertMany(products, { ordered: true, rawResult: false });
            //find 30 products with rawResult option
            //rawResult must be removed and the limit must be preserved by stargate-mongoose
            const findResp = await Product.find({ }, {}, { rawResult: false, limit : 30 });
            assert.strictEqual(findResp.length, 30);
        });
        it('should cleanup findOneAndReplaceOptions', async () => {
            //create 20 products using Array with id suffixed to prduct name
            // @ts-ignore
            const products: Product[] = [];
            for (let i = 0; i < 20; i++) {
                // @ts-ignore
                products.push(new Product({ name: `Product ${i}`, price: 10, isCertified: true }));
            }
            await Product.insertMany(products, { ordered: true, rawResult: false });
            //findOneAndReplace with rawResult option
            const findOneAndReplaceResp = await Product.findOneAndReplace({ name: 'Product 25' },
                { price: 20, isCertified: false, name: 'Product 25'},
                { rawResult: false, upsert: true, returnDocument: 'after' });
            assert.strictEqual(findOneAndReplaceResp.isCertified,false);
            assert.strictEqual(findOneAndReplaceResp.price,20);
            assert.ok(findOneAndReplaceResp._id);
            //find product 25
            const product25 = await Product.findOne({ name: 'Product 25' });
            assert.strictEqual(product25?.isCertified,false);
            assert.strictEqual(product25?.price,20);
            assert.strictEqual(product25?.name,'Product 25');
        });
        it('should cleanup findOneAndDeleteOptions', async () => {
            //create 20 products using Array with id suffixed to prduct name
            // @ts-ignore
            const products: Product[] = [];
            for (let i = 0; i < 20; i++) {
                if(i === 5 || i === 6) {
                    // @ts-ignore
                    products.push(new Product({ name: `Product ${i}`, price: 10, isCertified: true, category: 'cat 6' }));
                } else {
                    // @ts-ignore
                    products.push(new Product({ name: `Product ${i}`, price: 10, isCertified: true, category: `cat ${i}` }));
                }
            }
            await Product.insertMany(products, { ordered: true, rawResult: false });
            //findOneAndDelete with rawResult option and sort with name in ascending order
            await Product.findOneAndDelete({ category: 'cat 6' }, { rawResult: false, sort : { name : 1} });
            //check if Product 5 is deleted
            const product5 = await Product.findOne({ name: 'Product 5' });
            assert.strictEqual(product5, null);
            //check if Product 6 is not deleted
            const product6 = await Product.findOne({ name: 'Product 6' });
            assert.strictEqual(product6?.name, 'Product 6');
            assert.strictEqual(product6?.price, 10);
            assert.strictEqual(product6?.isCertified, true);
            assert.strictEqual(product6?.category, 'cat 6');
        });
        it('should cleanup findOneAndUpdateOptions', async () => {
            //create 20 products using Array with id suffixed to product name
            // @ts-ignore
            const products: Product[] = [];
            for (let i = 0; i < 20; i++) {
                // @ts-ignore
                products.push(new Product({ name: `Product ${i}`, price: 10, isCertified: true }));
            }
            await Product.insertMany(products, { ordered: true, rawResult: false });
            //findOneAndUpdate with rawResult option
            const upsertId = new mongoose.Types.ObjectId();
            const findOneAndUpdateResp = await Product.findOneAndUpdate({ name: 'Product 25' },
                { '$set' : {price: 20, isCertified: false, name: 'Product 25'}, '$setOnInsert' : {_id: upsertId} },
                { rawResult: false, upsert: true, returnDocument: 'after' });
            assert.strictEqual(findOneAndUpdateResp.isCertified,false);
            assert.strictEqual(findOneAndUpdateResp.price,20);
            assert.strictEqual(findOneAndUpdateResp.name,'Product 25');
            assert.strictEqual(findOneAndUpdateResp._id.toString(), upsertId.toString());
            //find product 25
            const product25 = await Product.findOne({ name: 'Product 25' });
            assert.strictEqual(product25?._id.toString(), upsertId.toString());
            assert.strictEqual(product25?.isCertified,false);
            assert.strictEqual(product25?.price,20);
            assert.strictEqual(product25?.name,'Product 25');
        });
    });
});
