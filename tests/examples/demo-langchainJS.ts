// Importing necessary modules and classes
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { AstraDBVectorStore, AstraLibArgs } from "@langchain/community/vectorstores/astradb";

// Constants and Environment Variables
const FILE_PATH = "./datasets";
const OPENAI_API_KEY = process.env['OPENAI_API_KEY'];

/**
 * Load and split documents from the local directory.
 * 
 * @returns {Promise<Array<Document>>} An array of split documents.
 */
async function loadDocs() {
  try {
    const loader = new DirectoryLoader(FILE_PATH, { ".txt": path => new TextLoader(path) });
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 15 });
    const texts = await splitter.splitDocuments(docs);

    console.log(`Loaded ${texts.length} documents.`);
    return texts;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

// Load documents and handle any errors
//loadDocs().catch(error => console.error('Failed to load documents:', error));

// Variable to store the vector store promise
let vectorStorePromise: Promise<AstraDBVectorStore>;

/**
 * Initialize and get the vector store as a promise.
 * 
 * @returns {Promise<AstraDBVectorStore>} A promise that resolves to the AstraDBVectorStore.
 */
export async function getVectorStore() {
  if (!vectorStorePromise) {
    vectorStorePromise = initVectorStore();
  }
  return vectorStorePromise;
}

async function initVectorStore() {
  try {
    const texts = await loadDocs();
    const astraConfig = getAstraConfig();

    // Initialize the vector store.
    const vectorStore = await AstraDBVectorStore.fromDocuments(
      texts, new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY, batchSize: 512 }), astraConfig
    );

    // Generate embeddings from the documents and store them.
    vectorStore.addDocuments(texts);
    console.log(vectorStore);
    return vectorStore;
  } catch (error) {
    console.error('Error initializing vector store:', error);
    throw error;
  }
}

// Specify the database and collection to use.
// If the collection does not exist, it is created automatically.
function getAstraConfig() {
  return {
    token: process.env.ASTRA_DB_APPLICATION_TOKEN as string,
    endpoint: process.env.ASTRA_DB_API_ENDPOINT as string,
    collection: process.env.ASTRA_DB_COLLECTION ?? "vector_test",
    collectionOptions: {
      vector: {
        dimension: 1536,
        metric: "cosine",
      },
    },
  } as AstraLibArgs;
}


getVectorStore().catch(error => console.error('Failed to run query:', error));
