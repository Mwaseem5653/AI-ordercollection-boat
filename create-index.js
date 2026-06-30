const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX_NAME;

// Serverless configuration: change cloud/region if needed
const cloud = process.env.PINECONE_CLOUD || 'aws';
const region = process.env.PINECONE_REGION || 'us-east-1'; // Standard free tier region

if (!apiKey || !indexName) {
    console.error("❌ ERROR: PINECONE_API_KEY and PINECONE_INDEX_NAME must be set in your .env file.");
    process.exit(1);
}

const pc = new Pinecone({ apiKey });

async function run() {
    try {
        console.log(`🔍 Checking existing indexes...`);
        const { indexes } = await pc.listIndexes();
        const indexExists = indexes?.some(idx => idx.name === indexName);

        if (indexExists) {
            console.log(`⚠️  Index "${indexName}" already exists! No need to create a new one.`);
            return;
        }

        console.log(`🚀 Creating index "${indexName}" with 768 dimensions (for gemini-embedding-001)...`);
        await pc.createIndex({
            name: indexName,
            dimension: 768, // Fixed at 768 for gemini-embedding-001
            metric: 'cosine', // Metric for semantic search similarity
            spec: {
                serverless: {
                    cloud,
                    region
                }
            }
        });

        console.log(`✅ Index "${indexName}" created successfully!`);
        console.log(`ℹ️  You can now run "node seed-pinecone.js" to seed your data.`);

    } catch (error) {
        console.error("❌ Error creating index:", error.message || error);
    }
}

run();
