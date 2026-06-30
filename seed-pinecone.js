const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ExcelJS = require('exceljs');
const path = require('path');
require('dotenv').config();

// API KEYS (Hardcoded as requested)
const apiKeys = [
    "AIzaSyCt4gzC6dDe8UHaXxNYkL_Qte96MHGbaCE",
    "AIzaSyCU5Ihxyd7bxmfAdRcmiW08gNhF00viKMk",
    "AIzaSyB50jDLMPfZMWeBXMKWxfByEq69J-7FYp4",
    "AIzaSyDaD9TAud9DMkrpCYtsQmqbGG_CE-j7uBU",
    "AIzaSyBrQkB13tmU2uxfiCUmGKzOBUfzYBaXBWE",
    "AIzaSyCCfJiKdcUv11yHEdbSQObOZVLSK4K7gJU",
    "AIzaSyBZp2DSvJkk7gGDGywdjl3wy6Khb3xZmLY",
    "AIzaSyAhuN658JbfB88RcLSTbaKYGL5g_3uLeVc",
    "AIzaSyBgupGNJjPeRRh3PLO44vMW177TQWRrEUg",
    "AIzaSyCPmM5JGfJTcqby7gd4OxhVfznVM9DKsOo",
    "AIzaSyC2JSXZUkakxyx4yJjcKQ7ZQqSFHi_ZsEA",
    "AIzaSyAq03ah9mjWmMqhez26pZVariYtHjog5jI",
    "AIzaSyCt4gzC6dDe8UHaXxNYkL_Qte96MHGbaCE"
].map(k => k.trim()).filter(k => k !== 'YOUR_KEY_1'); // Filter placeholder

if (apiKeys.length === 0) {
    console.error("❌ ERROR: Please paste your Gemini API keys inside the 'apiKeys' array in seed-pinecone.js");
    process.exit(1);
}

console.log(`📡 SYSTEM: Detected ${apiKeys.length} API Key(s) hardcoded.`);

let currentKeyIndex = 0;
let rotationAttempts = 0;

function getEmbeddingModel() {
    const key = apiKeys[currentKeyIndex];
    console.log(`🔑 Using API Key [Index: ${currentKeyIndex}]`);
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });
}

let embeddingModel = getEmbeddingModel();

function rotateKey() {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    rotationAttempts++;
    embeddingModel = getEmbeddingModel();
}

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const EXCEL_FILE = path.join(__dirname, 'profile updated for AI order application.xlsx');

const BATCH_SIZE = 72; 
const REQUEST_DELAY = 50; 

async function seedFromExcel() {
    try {
        console.log('🚀 Starting Seeding (Robust Keys + Rotation)...');
        const index = pc.index(indexName);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.getWorksheet(1);

        let vectorArray = [];
        let successCount = 0;
        const START_ROW = 2550;

        for (let i = START_ROW; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            const name = row.getCell(1).text.trim();
            const group = row.getCell(2).text.trim();
            const unit = row.getCell(3).text.trim();

            if (!name || name.toLowerCase() === 'product full name' || name === '') continue;

            try {
                const textToEmbed = `${group} - ${name} (${unit})`;
                const result = await embeddingModel.embedContent({
                    content: { parts: [{ text: textToEmbed }] },
                    outputDimensionality: 768
                });
                const embedding = result.embedding.values;

                vectorArray.push({
                    id: `row_${i}`,
                    values: embedding,
                    metadata: { 
                        fullName: name, 
                        group: group || "N/A", 
                        unit: unit || "N/A" 
                    }
                });

                console.log(`✨ [${i}/${sheet.rowCount}] Vector Ready: ${textToEmbed.substring(0, 50)}`);
                rotationAttempts = 0; // SUCCESS! Reset rotation counter so we can loop through all keys again for the next row.

                if (vectorArray.length >= BATCH_SIZE) {
                    console.log(`📤 Upserting ${vectorArray.length} records to Pinecone...`);
                    await index.upsert({ records: vectorArray });
                    successCount += vectorArray.length;
                    console.log(`✅ Progress Saved! Total: ${successCount}`);
                    vectorArray = [];
                    await new Promise(res => setTimeout(res, 500));
                }

            } catch (err) {
                console.error(`❌ Error at row ${i}:`, err.message);
                
                const isRetryable = err.message.includes('429') || 
                                  err.message.includes('quota') || 
                                  err.message.includes('limit') || 
                                  err.message.includes('API key not valid') ||
                                  err.message.includes('400');

                if (isRetryable && rotationAttempts < apiKeys.length) {
                    console.log(`⚠️ API Issue. Rotating to next key (Attempt ${rotationAttempts + 1}/${apiKeys.length})...`);
                    rotateKey();
                    await new Promise(res => setTimeout(res, 2000));
                    i--; // Retry
                } else {
                    console.log("❌ All keys exhausted or fatal error. Skipping row.");
                    rotationAttempts = 0;
                }
            }
        }

        if (vectorArray.length > 0) {
            await index.upsert({ records: vectorArray });
            successCount += vectorArray.length;
        }

        console.log(`\n🎉 SEEDING COMPLETE! Total: ${successCount}`);
    } catch (error) {
        console.error('❌ FATAL ERROR:', error);
    }
}

seedFromExcel();
