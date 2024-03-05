import * as fs from 'fs';
import * as util from 'util';
import { v4 as uuid } from 'uuid';

import { AstraDB, Collection } from "@datastax/astra-db-ts";
import { OpenAI } from "openai";
import { OpenAIEmbeddings } from "@langchain/openai";

import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// Convert the fs.readFile method into a promise so we can use async/await
const readFile = util.promisify(fs.readFile);

// Replace the below path with the path to your text file
const FILE_PATH = "./datasets";
const ASTRA_DB_APPLICATION_TOKEN: string = process.env.ASTRA_DB_APPLICATION_TOKEN || '';
const ASTRA_DB_API_ENDPOINT: string = process.env.ASTRA_DB_API_ENDPOINT|| '';

// Your OpenAI API key should be set in your environment variables for security reasons
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

type AstraDoc = {
    fileId: string;
    text: string;
    $vector: number[];
};

async function main() {

    try {
        const loader       = new DirectoryLoader(FILE_PATH, { ".txt": path => new TextLoader(path) });
        const docs         = await loader.load();
        const splitter     = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 15 });
        const splitDocs    = await splitter.splitDocuments(docs);
        const splitStrings = splitDocs.map((doc) => doc.pageContent);

        const embeddings = new OpenAIEmbeddings({ 
            openAIApiKey: process.env.OPENAI_API_KEY, 
            batchSize: 512,
            modelName: "text-embedding-3-small",
            maxConcurrency: 10,
            // verbose: true,
        });

        //console.log("Starting Embedding");
        const documentEmbeddings = await embeddings.embedDocuments(splitStrings);
        //console.log("Document embeddings:", JSON.stringify(documentEmbeddings));

        const astraDocs: AstraDoc[] = splitStrings.map((splitString, index) => ({
          fileId: uuid(),
          text: splitString,
          $vector: documentEmbeddings[index],
        }));

        console.log("Inserting into Astra");

        // Initialize the database connection
        const db = new AstraDB(ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT);
        const collection: Collection = await db.createCollection('collection_vector', {
            "vector": {
                "dimension": 1536,
                "metric": "cosine"
            }
        });

        console.log("Document embeddings: " + astraDocs.length);
        console.log("Document embeddings: " + splitDocs.length);
        
        const collection2 : Collection = await db.collection("collection_vector");
        // Create batches of the `astraDocs`, here assuming `20` as the batch size
        //const batches = chunkArray(splitDocs, 20);
        const batches = chunkArray(astraDocs, 21);

        // Map each batch to an insertMany operation, creating an array of Promises
        const batchesReq = batches.map((batch) => {
            collection2.insertMany(batch);
        }
        );
        
        // Use Promise.all to wait for all insertMany Promises to resolve
        await Promise.all(batchesReq)

        .then((result) => {
            console.log("All batches inserted successfully", result);
        })
        .catch((error) => {
            console.error("Error inserting batches", error);
        });


    } catch (error) {
        console.error("An error occurred while computing embeddings:", error);
    }
}

main().catch(error => console.error('Failed to run query:', error));
