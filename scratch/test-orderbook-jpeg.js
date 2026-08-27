const { GoogleGenerativeAI } = require('@google/generative-ai');
const { findBestProductMatchLocal, bulkVerifyProductsLocal } = require('../productSearch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No GEMINI_API_KEY!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const imgPath = path.join(__dirname, '../orderbook.jpeg');
if (!fs.existsSync(imgPath)) {
    console.error("orderbook.jpeg not found!");
    process.exit(1);
}

const imgData = fs.readFileSync(imgPath).toString('base64');

const schema = {
    type: 'OBJECT',
    properties: {
        trading_name: { type: 'STRING', description: 'Shop/Trading name mentioned in the image if any' },
        items: {
            type: 'ARRAY',
            description: 'List of order items extracted from the image. MANDATORY: Extract all products listed.',
            items: {
                type: 'OBJECT',
                properties: {
                    product: { type: 'STRING', description: 'Product name or code, including brand and color if found' },
                    size: { type: 'STRING', description: 'Size unit (e.g. Gallon, Drum, Quarter)' },
                    quantity: { type: 'NUMBER', description: 'Quantity of pieces' }
                },
                required: ['product']
            }
        }
    },
    required: ['items']
};

const serverCode = fs.readFileSync('whatsapp-server.js', 'utf8');
const match = serverCode.match(/const SALESBOT_INSTRUCTIONS = `([\s\S]*?)`;/);
const promptMatch = serverCode.match(/text:\s*`This image contains a handwritten order slip[\s\S]*?`\s*\}/);

async function testOrderBook() {
    console.log("📸 [TESTING VISION OCR ON orderbook.jpeg]...");
    
    const promptText = `This image contains a handwritten order slip from a Paint & Hardware wholesale shop.

MANDATORY ITEM EXTRACTION RULE:
- Every image sent is an order slip containing product items. You MUST extract all order items and products visible in the image into the "items" array.
- NEVER return only the trading_name without items. Extracting all order items and products is your primary mandatory requirement.

CRITICAL LAYOUT & QUANTITY EXTRACTION RULES:

1. INDEPENDENT COLUMN SEGREGATION:
- The sheet has multiple columns (e.g. 3 or 4 columns). Analyze each column completely independently.
- Headers are underlined (e.g. "xtra semi", "Xtra putt", "oil primer xtra", "bold putt", "bold water prim", "oil primer bold", "enamel xtra", "Stanles xtra", "9986", "9962", "9973", "51", "230", "66", "303", "301").
- DO NOT mix products from different columns. 

2. POSITION-BASED SLASH NOTATION (G / Q / D):
- Quantities are often written in positional slash notation: [Gallons] / [Quarters] / [Drums].
- This strictly maps to sizes in this exact order: Gallon / Quarter / Drum.
- Zero-quantity placeholders: Positions filled with a cursive loop/alpha symbol (α), cross (x), dot (.), dash (-), or left blank represent zero (0) quantity. Do NOT extract zero-quantity items.
- Examples:
  * "4 / α / α" under "9986" -> {"product": "9986", "size": "Gallon", "quantity": 4}
  * "20 / α / α" under "9973" -> {"product": "9973", "size": "Gallon", "quantity": 20}
  * "α / 4 / α" under "303" -> {"product": "303", "size": "Quarter", "quantity": 4}
  * "α / 2 / α" under "301" -> {"product": "301", "size": "Quarter", "quantity": 2}
  * "α / 6 / α" under "66" -> {"product": "66", "size": "Quarter", "quantity": 6}

3. STRICT CODE vs QUANTITY RULE (EXPLICIT SIZE LABELS):
- If a line starts with a code number, a slash, and then a quantity number with an explicit size label (e.g., "37/ 2 Qtr" or "66/ 4 Gln" or "51/ 2 Qtr" or "44/ 2 Gln"):
  * The first number is the **Product Code** (do NOT parse it as a quantity!).
  * The second number is the **Quantity** (e.g., 2, 4, 2, 2).
  * Examples:
    - "37/ 2 Qtr" under "xtra semi" -> {"product": "extra semi 37", "size": "Quarter", "quantity": 2}
    - "66/ 4 Gln" -> {"product": "extra enamel 66", "size": "Gallon", "quantity": 4}

4. GENERIC SHORTHAND SEPARATORS (NO CODES):
- Putty (e.g., "Xtra putt", "bold putt") and Primers (e.g., "oil primer bold", "bold water prim") DO NOT use numeric codes!
- For Putty and Primers, any numbers (like 10, 5, 4, 2) are ONLY quantities, NEVER product codes.
  * Example: "10/ 2tr" under "Xtra putt" means: 10 Gallons and 2 Quarters of "Extra Putty" (no code "10" or "2" exists).
  * "10/ Gln" under "Xtra putt" -> 10 Gallons.
  * "4/ 2tr" under "bold water prim" -> 4 Gallons and 2 Quarters.
- Shorthand units: "tr", "qtr", "q", "2tr", "2t" mean "Quarter". "Gln" means "Gallon". "Drm" means "Drum".

5. HANDWRITING TYPOS & SYNONYMS:
- "off wht" or "% wht" or "% mll" -> "Off White"
- "Ashwt" or "Ashut" or "Ashul" -> "Ash White"
- "putt" -> "Putty"
- "w"    -> "White"
- "xtra" or "xts" or "xto" -> "Extra"
- "enamel" or "ennamel" or "enamml" -> "Enamel"
- "Stanles" or "Stanl" -> "Stainless"
- "W/S" -> "Weather Shield"

6. TRADING NAME / SHOP NAME:
- Check for shop/customer name written at the top (e.g. "society Paint PECHS", "Nadeem colle"). Extract it as trading_name if present.

Extract ALL order items into the JSON schema "items" array. Split shorthand entries into separate items (one item per size). Do not omit any items.`;

    const res = await visionModel.generateContent({
        contents: [
            {
                role: 'user',
                parts: [
                    { text: promptText },
                    { inlineData: { data: imgData, mimeType: 'image/jpeg' } }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });

    const rawJsonText = res.response.text().trim();
    console.log(`\n📋 --- RAW VISION OCR EXTRACTED JSON --- \n${rawJsonText}\n`);

    const parsed = JSON.parse(rawJsonText);
    console.log(`Trading Name Extracted: "${parsed.trading_name || 'NONE'}"`);
    console.log(`Extracted Items Count: ${parsed.items ? parsed.items.length : 0}`);

    if (parsed.items && parsed.items.length > 0) {
        console.log("\n🔍 --- RUNNING BULK VERIFICATION ON EXTRACTED ITEMS ---");
        const bulkInput = parsed.items.map(i => ({
            nameOrCode: i.product,
            requestedSize: i.size || 'Gallon'
        }));
        const verifiedResults = bulkVerifyProductsLocal(bulkInput);
        
        parsed.items.forEach((item, idx) => {
            const vr = verifiedResults[idx];
            console.log(`Item ${idx+1}: "${item.product}" | Size: ${item.size} | Qty: ${item.quantity}`);
            console.log(`   Verification: ${vr.result}`);
        });
    }
}

testOrderBook();
