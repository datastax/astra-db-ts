import * as fs from 'fs';
import * as util from 'util';
import { v4 as uuid } from 'uuid';

import { AstraDB, Collection } from "@datastax/astra-db-ts";
import { SomeDoc, VectorDoc, InsertOneResult, InsertManyResult } from '@datastax/astra-db-ts/dist/client';

// Replace the below path with the path to your text file
export type Product = SomeDoc & {
    name: string;
    price: number;
};

export type ProductWithVector = Product & VectorDoc;

const generateRandomProductList = (numProducts: number): Product[] => {
    
    // Sample food names
    const foodNames = [
        "Apples", "Bananas", "Carrots", "Dates", "Eggs",
        "Fish", "Grapes", "Honey", "Ice Cream", "Jam",
        "Kale", "Lettuce", "Mangoes", "Nuts", "Oranges",
        "Pasta", "Quinoa", "Rice", "Spinach", "Tomatoes"
    ];

    // Function to generate a random price
    const getRandomPrice = (min: number, max: number): number => {
        return parseFloat((Math.random() * (max - min) + min).toFixed(2));
    };

    // Generate a list of products
    return Array.from({ length: numProducts }, (): Product => {
        const name = foodNames[Math.floor(Math.random() * foodNames.length)];
        const price = getRandomPrice(0.99, 9.99);
        return { name, price };
    });
};

async function main() {

    const ASTRA_DB_APPLICATION_TOKEN: string = process.env.ASTRA_DB_APPLICATION_TOKEN || '';
    const ASTRA_DB_API_ENDPOINT: string = process.env.ASTRA_DB_API_ENDPOINT|| '';
    const db: AstraDB = new AstraDB(ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT);
    console.log('Connected to db & namespame=' + db.namespace);

    try {
        
        // Collections initializations (typed)
        const collection_simple: Collection = await db.createCollection<Product>('collection_simple');
        console.log('+ Collection ' + collection_simple.name + ' created (if needed)');
 
        // Flush the collection if not null
        await collection_simple.deleteMany({});
        console.log('+ Collection ' + collection_simple.name + ' flushed');
        
        // Inserting a simple 
        const p1: Product = generateRandomProductList(1)[0];
        const resultOne = await collection_simple.insertOne(p1);
        console.log('+ One Product inserted id=' + resultOne.insertedId);

        const resultMany = await collection_simple.insertMany(generateRandomProductList(20));
        const count1 = await collection_simple.countDocuments();
        console.log('+ InserMany with 20, insertedIdsLength=' + resultMany.insertedIds.length + ', total item(s) in collection= ' + count1);

        const resultManyBulk: InsertManyResult = await collection_simple.insertManyBulk(generateRandomProductList(50));
        const count2 = await collection_simple.countDocuments();
        console.log('+ InserMany with 50, InsertManyResult.insertedIds.length=' + resultManyBulk.insertedIds.length + ', total item(s) in collection= ' + count2);

        console.log('something');
        const count3 = await collection_simple.countDocuments();
        console.log(count3);


        
    } catch (error) {
        console.error("An error occurred while computing embeddings:", error);
    }
}

async function workingWithVector() {
    

}

main().catch(error => console.error('Failed to run query:', error));
