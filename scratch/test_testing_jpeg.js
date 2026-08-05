const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('🛑 [ERROR]: GEMINI_API_KEY is not defined in your environment/dotenv.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

const imagePath = path.join(__dirname, '../testing.jpeg');

if (!fs.existsSync(imagePath)) {
  console.error(`🛑 [ERROR]: Image not found at ${imagePath}`);
  process.exit(1);
}

const fileToGenerativePart = (filePath, mimeType) => {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType
    },
  };
};

const PROMPT_TEXT = `This is a handwritten order slip/image from a Paint & Hardware wholesale shop.
CRITICAL LAYOUT & QUANTITY EXTRACTION RULES:

1. INDEPENDENT COLUMN SEGREGATION:
- The sheet has multiple columns (e.g. 3 or 4 columns). Analyze each column completely independently.
- Headers are underlined (e.g. "xtra semi", "Xtra putt", "oil primer xtra", "bold putt", "bold water prim", "oil primer bold", "enamel xtra", "Stanles xtra", "9986", "9962", "9973", "51", "230", "66", "303", "301").
- DO NOT mix products from different columns. 

2. POSITION-BASED SLASH NOTATION (G / Q / D):
- Quantities are often written in positional slash notation: [Gallons] / [Quarters] / [Drums].
- This strictly maps to sizes in this exact order: Gallon / Quarter / Drum.
- Zero-quantity placeholders: Positions filled with a cursive loop/alpha symbol (α), cross (x), dot (.), dash (-), or left blank represent zero (0) quantity. Do NOT extract zero-quantity items.

3. STRICT CODE vs QUANTITY RULE (EXPLICIT SIZE LABELS):
- If a line starts with a code number, a slash, and then a quantity number with an explicit size label (e.g., "37/ 2 Qtr" or "66/ 4 Gln" or "51/ 2 Qtr" or "44/ 2 Gln"):
  * The first number is the **Product Code** (do NOT parse it as a quantity!).
  * The second number is the **Quantity** (e.g., 2, 4, 2, 2).

4. GENERIC SHORTHAND SEPARATORS (NO CODES):
- Putty (e.g., "Xtra putt", "bold putt") and Primers (e.g., "oil primer bold", "bold water prim") DO NOT use numeric codes!
- For Putty and Primers, any numbers are ONLY quantities, NEVER product codes.

5. HANDWRITING TYPOS & SYNONYMS:
- "off wht" or "% wht" or "% mll" -> "Off White"
- "Ashwt" or "Ashut" or "Ashul" -> "Ash White"
- "putt" -> "Putty"
- "w"    -> "White"
- "xtra" or "xts" or "xto" -> "Extra"
- "enamel" or "ennamel" or "enamml" -> "Enamel"
- "Stanles" or "Stanl" -> "Stainless"
- "W/S" -> "Weather Shield"

Extract all items into a JSON output containing 'trading_name' and 'items' array (with keys 'product', 'size', and 'quantity').`;

const schema = {
  type: 'OBJECT',
  properties: {
    trading_name: { type: 'STRING', description: 'Shop/Trading name mentioned in the image if any' },
    items: {
      type: 'ARRAY',
      description: 'List of order items extracted from the image',
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
  }
};

async function testImage() {
  console.log(`📸 [TEST]: Processing "testing.jpeg" using gemini-3.5-flash-lite...`);
  
  try {
    const imagePart = fileToGenerativePart(imagePath, 'image/jpeg');
    
    const res = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT_TEXT },
            imagePart
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });

    console.log('\n====== EXTRACTED JSON RESPONSE ======');
    console.log(res.response.text());
    console.log('=====================================\n');
    
  } catch (err) {
    console.error('🛑 [ERROR PROCESSING IMAGE]:', err.message);
  }
}

testImage();
