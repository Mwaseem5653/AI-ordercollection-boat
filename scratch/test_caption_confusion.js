const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const imagePath = path.join(__dirname, '../testing.jpeg');

const fileToGenerativePart = (filePath, mimeType) => {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType
    },
  };
};

const PROMPT_BASE = `This is a handwritten order slip/image from a Paint & Hardware wholesale shop.
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

Extract all items into the JSON schema, splitting shorthand entries into separate items (one item per size). Do not include zero-quantity items.`;

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

async function testWithCaption() {
  const imagePart = fileToGenerativePart(imagePath, 'image/jpeg');

  console.log('\n--- RUN 2: WITH OLD CAPTION HINT "Naveed paint baldia" ---');
  const oldCaptionHint = `The user also wrote this caption with the image: "Naveed paint baldia". Use both the image and caption together.`;
  try {
    const res2 = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: PROMPT_BASE + '\n' + oldCaptionHint }, imagePart] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
    });
    const parsed2 = JSON.parse(res2.response.text());
    console.log(`Extracted items count with old hint: ${parsed2.items ? parsed2.items.length : 0}`);
  } catch (e) {
    console.error('Run 2 failed:', e.message);
  }

  console.log('\n--- RUN 3: WITH NEW DEFENSIVE CAPTION HINT "Naveed paint baldia" ---');
  const newCaptionHint = `\nNOTE: The user also wrote this caption: "Naveed paint baldia". Please use this caption to identify the trading/shop name if it is not written on the image. Do NOT let this caption override or ignore the handwritten items in the image — you must still extract all order items from the handwritten image slip.`;
  try {
    const res3 = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: PROMPT_BASE + '\n' + newCaptionHint }, imagePart] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
    });
    const parsed3 = JSON.parse(res3.response.text());
    console.log(`Extracted items count with new hint: ${parsed3.items ? parsed3.items.length : 0}`);
    console.log('JSON returned in Run 3:');
    console.log(JSON.stringify(parsed3, null, 2).substring(0, 500) + '... (truncated)');
  } catch (e) {
    console.error('Run 3 failed:', e.message);
  }
}

testWithCaption();
