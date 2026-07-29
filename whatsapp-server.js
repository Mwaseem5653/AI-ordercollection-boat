const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Agent, run, OpenAIChatCompletionsModel, setTracingDisabled, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
const { findBestProductMatchLocal, bulkVerifyProductsLocal } = require('./productSearch');
require('dotenv').config();

setTracingDisabled(true);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const EXCEL_FILE = path.join(__dirname, 'orders.xlsx');

// ============================================================
// API CONFIG
// ============================================================
const apiKey = process.env.GEMINI_API_KEY;

function getNativeModel() {
    return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// ============================================================
// OPENAI-COMPAT CLIENT FOR AGENT ORCHESTRATION
// ============================================================
const geminiOpenAIClient = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});
const geminiModel = new OpenAIChatCompletionsModel(geminiOpenAIClient, 'gemini-2.5-flash');

// ============================================================
// STATE
// ============================================================
let stats = { total: 0, orders: 0, pending: 0, ignored: 0 };
let ordersCache = [];
let qrCodeData = '';
let clientStatus = 'stopped';

// Load existing orders from Excel on startup
async function loadOrdersFromExcel() {
    if (!fs.existsSync(EXCEL_FILE)) return;
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const sheet = workbook.getWorksheet('Orders');
        if (!sheet) return;

        const data = [];
        let currentSno = '';
        let currentDate = '';
        let currentGroup = '';
        let currentCustomer = '';
        let currentPhone = '';
        let currentTrading = '';

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const values = row.values;
            if (!values) return;

            // Skip empty separator rows (which won't have a product name in column 7)
            if (!values[7]) return;

            // Carry over values if they are merged (null/undefined)
            if (values[1] !== undefined && values[1] !== null) currentSno = values[1];
            if (values[2] !== undefined && values[2] !== null) currentDate = values[2];
            if (values[3] !== undefined && values[3] !== null) currentGroup = values[3];
            if (values[4] !== undefined && values[4] !== null) currentCustomer = values[4];
            if (values[5] !== undefined && values[5] !== null) currentPhone = values[5];
            if (values[6] !== undefined && values[6] !== null) currentTrading = values[6];

            data.push({
                'S.No': currentSno,
                'Date': currentDate,
                'Group Name': currentGroup,
                'Customer Name': currentCustomer,
                'Phone Number': currentPhone,
                'Trading Name': currentTrading,
                'Product Name': values[7],
                'Product Size': values[8],
                'Quantity (Pcs)': values[9],
                'Unit': values[10],
                'NTF': values[11]
            });
        });
        ordersCache = data;
        stats.orders = new Set(data.map(o => `${o.Date}_${o['Phone Number']}`)).size;
        console.log(`📊 [INIT]: Loaded ${data.length} items from Excel.`);
    } catch (e) {
        console.error('🛑 [LOAD ERROR]:', e.message);
    }
}
loadOrdersFromExcel();

const chatSessions = {};




const GROUP_NAMES = (process.env.WHATSAPP_GROUP_NAMES || '')
    .split(',')
    .map(g => g.toLowerCase().replace(/[^a-z0-9]/g, '').trim())
    .filter(Boolean);

console.log('📋 [CONFIG]: Monitoring groups (cleaned):', GROUP_NAMES);

// ============================================================
// PRODUCT SEARCH — Local JSON (Pinecone replaced)
// ============================================================
function findBestProductMatch(nameOrCode, requestedSize, wantNoToken = false, sessionCache = null, phoneNumber = null) {
    return findBestProductMatchLocal(nameOrCode, requestedSize, wantNoToken, sessionCache, phoneNumber);
}

// ============================================================
// TOOL FACTORY (per-session)
// ============================================================
function createTools(session) {
    const sessionCache = session.verifiedProducts;

    const matchTool = tool({
        name: 'findBestProductMatch',
        description: `REQUIRED before every product confirmation.        
Pass wantNoToken=true if user says "TX" or "bagher token or DX/GX/QX".
Enforces strict exact code matching (e.g. 5055 does NOT match 55; non-existent codes return NOT_IN_DATABASE).
Enforces brand requirement for codes in multiple brands (e.g., DD41 exists in Altra and Hi; returns AMBIGUOUS if brand is missing in query).
Enforces strict field matching for queries without codes (returns AMBIGUOUS if brand, product, or color is omitted and multiple database variants exist).
Tool returns: MATCH / MULTIPLE_MATCHES / AMBIGUOUS / LOW_CONFIDENCE / SIZE_NOT_AVAILABLE / NOT_IN_DATABASE / NO_TOKEN_NOT_AVAILABLE`,
        parameters: z.object({
            nameOrCode: z.string().describe("Product name, code, aur color (e.g., 'EXTRA WHITE PUTTY', 'DA45 RED'). AGAR user ne color mention kiya hai, toh use strictly is parameter me brand/product/code ke sath zaroor include karein. Isme size ya quantity include mat karein."),
            requestedSize: z.string().describe("Sirf requested size/unit (e.g., 'Gallon', 'Drum', 'Quarter', 'G', 'D', 'Q'). Quantity numbers (jaise '2' ya '5') isme include nahi hone chahiye."),
            wantNoToken: z.boolean().optional()
        }),
        execute: async ({ nameOrCode, requestedSize, wantNoToken }) =>
            findBestProductMatch(nameOrCode, requestedSize, wantNoToken, sessionCache, session.phoneNumber)
    });

    const bulkVerifyTool = tool({
        name: 'bulkVerifyProducts',
        description: `Verify multiple products 3 times only. Use when order has 2+ items.
Already-verified products session cache se milte hain — zero extra calls unke liye.
Enforces the same strict matching rules as findBestProductMatch.
Returns array of {original, result} — result same format as findBestProductMatch (can be MATCH / MULTIPLE_MATCHES / etc.).`,
        parameters: z.object({
            items: z.array(z.object({
                nameOrCode: z.string().describe("Product name, code, aur color (e.g., 'EXTRA WHITE PUTTY', 'DA45 RED'). AGAR user ne color mention kiya hai, toh use strictly is parameter me brand/product/code ke sath zaroor include karein. Isme size ya quantity include mat karein."),
                requestedSize: z.string().describe("Sirf requested size/unit (e.g., 'Gallon', 'Drum', 'Quarter', 'G', 'D', 'Q'). Quantity numbers (jaise '2' ya '5') isme include nahi hone chahiye."),
                wantNoToken: z.boolean().optional()
            }))
        }),
        execute: async ({ items }) => {
            const results = bulkVerifyProductsLocal(items, sessionCache, session.phoneNumber);
            return JSON.stringify(results);
        }
    });

    // ── submitOrder — replaces the old "ORDER_SUCCESS:" text-marker +
    // regex-parsing approach. A schema-validated tool call can't be broken
    // by the model adding stray words before/after the JSON, and it saves
    // the order directly instead of round-tripping through free text.
    const submitOrderTool = tool({
        name: 'submitOrder',
        description: `Call this ONLY once, when every item is a confirmed MATCH, the trading name is known, and the customer has confirmed (YES/OK/HAAN/G/DONE/CONFIRM). This directly saves the order — do not also try to output a JSON block yourself.`,
        parameters: z.object({
            items: z.array(z.object({
                product: z.string().describe("Exact, unmodified product name returned by the match tool, including its trailing size suffix (e.g. 'EXTRA ENAMEL 66 BLACK-Q')."),
                size: z.string().describe("Drum / Gallon / Quarter"),
                quantity: z.number(),
                unit: z.string().optional().describe("Leave blank if unsure — it will be filled in automatically from the verified match.")
            })),
            tradingName: z.string()
        }),
        execute: async ({ items, tradingName }) => {
            try {
                const processedItems = items.map(item => {
                    let unit = item.unit;
                    if (!unit) {
                        const sz = (item.size || '').toLowerCase();
                        const key = `${item.product.toLowerCase()}_${sz}_false`;
                        const cached = sessionCache[key] || '';
                        const unitMatch = cached.match(/Unit:\s*([^\|]+)/);
                        if (unitMatch) unit = unitMatch[1].trim();
                    }
                    return {
                        ...item,
                        unit,
                        isNTF: item.product.startsWith('user_raw_NTF_')
                    };
                });

                await writeToExcel(
                    processedItems,
                    session.senderName,
                    session.groupName || 'Group',
                    session.phoneNumber,
                    tradingName || 'UNKNOWN'
                );

                // Flag on the session so the message handler (which owns the
                // WhatsApp reply + Excel context) knows to send the fixed
                // confirmation and close the session — no regex parsing needed.
                session.orderSubmitted = true;
                stats.orders++;
                return 'ORDER_SAVED_OK';
            } catch (e) {
                console.error('🛑 [SUBMIT ORDER TOOL ERROR]:', e.message);
                return 'ORDER_SAVE_FAILED';
            }
        }
    });

    return [matchTool, bulkVerifyTool, submitOrderTool];
}

// ============================================================
// ORDER AGENT — compact instructions, cached per session
// ============================================================
const SALESBOT_INSTRUCTIONS = `SalesBot: Paint & Hardware wholesale WhatsApp order assistant.
Reply ONLY in Roman Urdu. No greetings, no chit-chat, no English to users.

1. CLASSIFY — SIRF pehle fresh message par:
   - Agar conversation history BILKUL nahi hai (pehla message) AND message sirf general chat hai
     (Hi/Hello/Thanks/Kaise ho/Shukriya jaise greetings) → output "IGNORE_CHAT", no tools.
   - IMPORTANT: Agar koi bhi conversation history already maujood hai (ongoing order session),
     toh KABHI BHI "IGNORE_CHAT" mat likho — chahe user kuch bhi likhey. Hamesha respond karo.
   - Order/confirmation (item+qty+size OR YES/OK/HAAN/G/DONE/CONFIRM) → process.
   - Mid-order query, correction, ya ghalat info → context dekh kar samjhao ya dobara poochein.

2. EXTRACT & VERIFY (every item, no guessing):
   - Use bulkVerifyProducts for 2+ items, findBestProductMatch for 1.
   - Never call same tool twice in one turn.
   - balti=Gallon, F.P=Filling Putty.
   - STRICT TOOL PARAMETER RULES:
     * Tool call karte waqt user ki quantity (e.g. 2, 5) ko size se ALAG karein.
     * "requestedSize" me sirf clean size unit (jaise 'Gallon', 'Drum', 'Quarter' ya 'G', 'D', 'Q') pass karein. Kabhi bhi quantity (jaise '2 gln') pass na karein.
     * "nameOrCode" me brand, product name, code, aur color pass karein. AGAR user ne color mention kiya hai (jaise "red", "green", "magnolia", "ash white" etc.), toh use strictly "nameOrCode" parameter me zaroor include karein. Isme size ya quantity mix na karein.
     * CODE vs QUANTITY — simple rule: a number immediately followed by a size
       word ('gln','drum','qtr','g','d','q') is a QUANTITY, never a code.
       A number followed by 'no'/'code'/'number', or standing alone as a
       product identifier, is a CODE and belongs in 'nameOrCode'.
     * Worked examples:
       - "2 no k 2 gln"  -> code="2", quantity=2, size=Gallon
       - "bold 55 2 drum" -> code="55" (belongs with brand), quantity=2, size=Drum
       - "extra semi white 3 gln" -> no code, quantity=3, size=Gallon
     * If genuinely unsure whether a number is a code or a quantity, ask the
       customer in one short line instead of guessing — a wrong guess here
       causes silent order errors.

3. SPELLING / TYPOS — DO NOT correct these yourself:
   - The product search tool already normalizes brand, product, and color spelling
     (typos, shorthand, common misspellings). Pass the customer's words through
     mostly as-is inside "nameOrCode" — just keep brand + product + code + color
     together, and keep size/quantity OUT of "nameOrCode".
   - Example: customer writes "xtra w/s mangolia 2g" ->
     nameOrCode = "extra weather shield mangolia", requestedSize = "Gallon".
     (The tool will fix "mangolia"-type typos on its own — you do not need a
     correction table for this.)

4. TOOL RESULTS & CORRECTIONS — Har issue wale item ko bilkul saaf aur structured format (Roman Urdu) me dikhayein:
   - Use bold numbering for items with issues (e.g., "*Item 1:*", "*Item 2:*").
   - Multi-item issues me har item ke baad double-line break (blank line) zaroor dalein taake saaf format ho.
   - Clean Urdu templates for each issue type:
     - MATCH → use official name (no clarification needed).
     - MULTIPLE_MATCHES →
       * Pehle chat history aur context check karein. Agar context se clear ho ke user kaunsa option chahta hai (e.g., user pehle kis brand/product ki baat kar raha tha), toh automatic best match select kar lein aur user se na poochein.
       * Agar context se clear nahi hai aur options ambiguous hain, toh use niche diye gaye AMBIGUOUS format me convert karein aur options show kar ke user se choose karne ko kahein.
     - AMBIGUOUS (Incomplete Info) →
       Format: "*Item [N]:* (IN-Complete INFO) - [Item Name/Code] ke liye details adhuri hain. Meharbani karke Brand, Product, ya Color wazeh karein. Kya aap inme se chahte hain? \n[List of options with numbers]"
     - SIZE_NOT_AVAILABLE →
       Format: "*Item [N]:* - [Item Name] me requested size available nahi hai. Yeh sizes mil sakti hain: [Available Sizes]. Aapko kaunsa size chahiye?"
     - NOT_IN_DATABASE →
       Format: "*Item [N]:* - [Item Name/Code] database me nahi mila. Meharbani karke spelling check karein ya correct code batayein."
     - NO_TOKEN_NOT_AVAILABLE →
       Format: "*Item [N]:* - [Item Name] bagher token ke available nahi hai. Kya aapko token ke saath chahiye ya is item ko cancel karna hai?"

5. ORDER FORMAT expected from user:
   BRAND | CODE or PRODUCT | COLOR | SIZE(Drum/Gallon/Quarter) | QTY
   e.g. "Bold 1066 2g" or "Bold semi white 2g"
   Brands: EXTRA, TREND, BOLD, BUDGET, EXCLUSIVE, FLUORESCENT, ALTRA, BONDEX → auto correct word mistakes before query

   MISSING INFO — KABHI BHI assume ya guess mat karo. Agar koi zaroori field missing ho:

   ❌ QTY missing:
      → User se seedha poochein: "*Qty batayein:* Aapko [Product Name] ki kitni quantity chahiye?"
      → Qty ke bina order proceed NAHI karna.

   ❌ BRAND missing (aur code ambiguous ho):
      → Tool AMBIGUOUS return karega. Phir user ko clearly likhein:
        "*Brand batayein:* [Code] kai brands mein available hai — konsa chahiye?"
        Aur options list karein (e.g., "1. Altra  2. Hi Look")
      → Brand confirm hone ke baad hi aage barho.

   ❌ SIZE missing:
      → User se poochein: "*Size batayein:* [Product] ke liye kaunsa size chahiye? (Gallon / Drum / Quarter)"

   Rule: Ek message mein sirf ek cheez poochein. Agar qty bhi missing hai aur brand bhi, pehle brand poochein phir qty.

6. TRADING NAME rules:
   - Agar aapne user se trading/shop name poocha hai, toh uske baad user jo bhi response deta hai (e.g., "Mubeen Traders", "Ali Paint Store"), use strictly "trading_name" samjhein aur verify karne ke liye tools me pass na karein.
   - KABHI BHI trading name ko product match tools (findBestProductMatch / bulkVerifyProducts) me pass mat karein. Trading name koi product ya code nahi hota, isliye tool error default block karein.
   - Shop/trading name identifiers: words like 'Traders', 'Paint', 'Store', 'Shop', 'Enterprises', 'Distributors', 'Co' etc. Agar user aisa koi naam bheje aur wo humare paint brands se match nahi karta, toh use strictly "trading_name" samjhein.
   - Agar user ne order message ke sath hi trading name likh diya (same message mein) toh use directly use karo, alag se mat poochho.
   - Agar user ne order confirm karne ke BAAD (next message mein) sirf trading name bheja (e.g. "ABC Traders", "Ali Paint") toh use trading name samjho aur turant "submitOrder" tool call karo.
   - CRITICAL: Jab trading name mil jaye aur sare items verified hoon, sirf "submitOrder" tool call karo — koi alag JSON ya extra confirmation text mat likho uske sath usi turn mein.

7. FINAL LIST — sirf tab dikhao jab SARE items MATCH ho jayein + trading name mil jaye agher trading name nahn to phele users se confirm karna h.
   STRICT FORMATTING & SPACING INSTRUCTIONS:
   - Final list ka format bilkul fixed aur uniform hona chahiye. Space errors bilkul nahi honi chahiye.
   - Har line ke start me koi bhi extra space ya tab nahi hona chahiye. Direct serial number se start karein (e.g., "1. ", "2. ").
   - Serial number ke dot (.) ke baad exact ek space hona chahiye: "1. [Product]..."
   - Pipe (|) symbols ke dono taraf exact ek space hona chahiye: "[Product] | [Size] | [Qty]". 
     KABHI BHI bina space ke pipe ya multiple spaces ke sath pipe mat likhna (e.g., NOT "[Product]| [Size]" and NOT "[Product]  |  [Size]").
   - Item/Qty ke bilkul aakhir me koi extra trailing space nahi honi chahiye.
   - CRITICAL: In [Product], you MUST use the exact, unmodified product name returned by the match tool (e.g., findBestProductMatch or bulkVerifyProducts), including the trailing size suffix (such as -D, -G, -Q, -DX, -GX, etc.). DO NOT remove or modify this suffix!
   
   Final List Format:
   1. [Product] | [Size] | [Qty]

   Example:
   1. EXTRA ENAMEL 66 BLACK-Q | Qtr | 2
   2. EXTRA ENAMEL 316 SHARP BROWN-G | Gln | 3
   
   Phir poochein: "Yeh list check karlein, theek hai toh YES likh kar confirm kardein. ✅"

8. ON CONFIRMATION (YES/OK/HAAN/G/DONE/CONFIRM) — call the "submitOrder" tool.
   - Pass each item's exact, unmodified product name as returned by the match
     tool, including the trailing size suffix (e.g. "EXTRA ENAMEL 66 BLACK-Q").
     DO NOT strip or modify this suffix.
   - Pass the trading name you collected.
   - After the tool returns success, reply with ONE short Roman Urdu line
     confirming the saved order (e.g. list the items briefly). Do not repeat
     the tool call, and do not fabricate a JSON block yourself — the tool
     call itself is what saves the order.
   - If the tool returns a failure result, tell the customer there was a
     technical issue and to please resend in a moment — do not retry the
     tool call more than once in the same turn.`;

function createOrderAgent(sessionTools) {
    return new Agent({
        name: 'SalesBot',
        model: geminiModel,
        tools: sessionTools,
        instructions: SALESBOT_INSTRUCTIONS
    });
}

// ============================================================
// WHATSAPP CLIENT
// ============================================================
// Crash-proofing against unhandled EBUSY/resource locked rejections in Puppeteer/Windows
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('EBUSY')) {
        console.warn('⚠️ [EBUSY LOCK BYPASS]: Ignored asynchronous file lock warning during Puppeteer lifecycle.');
        return;
    }
    console.error('🛑 Unhandled Rejection at:', promise, 'reason:', reason);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',       // RAM issue fix (shared memory)
            '--disable-accelerated-2d-canvas',
            '--no-first-run',                // Skip first-run setup
            '--no-zygote',                   // Faster process spawning
            '--disable-gpu',                 // GPU disable (no display on server)
            '--disable-software-rasterizer',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-default-browser-check',
            '--safebrowsing-disable-auto-update',
            '--disk-cache-size=0',           // Cache permission errors fix
            '--media-cache-size=0',
            '--disable-features=FirstPartySets', // Disable features writing to disk asynchronously
            '--disable-features=PrivacySandboxSettings4',
        ]
    }
});

client.on('qr', qr => {
    qrCodeData = qr;
    clientStatus = 'qr_ready';
    qrcode.generate(qr, { small: true });
    console.log('📱 QR Code ready — scan to connect');
});

client.on('ready', () => {
    if (clientStatus === 'connected') return; // Avoid double logging
    clientStatus = 'connected';
    console.log('✅ WhatsApp connected!');
    console.log('📡 Monitoring groups:', GROUP_NAMES.join(', ') || 'ALL DMs');
});

client.on('disconnected', reason => {
    clientStatus = 'stopped';
    console.log('❌ WhatsApp disconnected:', reason);
});

// ============================================================
// MESSAGE HANDLER
// ============================================================
client.on('message', async msg => {
    try {
        if (msg.from === 'status@broadcast' || msg.isStatus) return;
        if (!msg.from.endsWith('@g.us')) return;

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const rawGroupName = chat.name ? chat.name : 'Unknown';

        const pushName = contact.pushname || 'Customer';
        const senderNumber = (msg.author || msg.from).split('@')[0];

        if (msg.from.endsWith('@g.us')) {
            const cleanGroupName = rawGroupName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!GROUP_NAMES.includes(cleanGroupName)) {
                console.log(`⏭️  [IGNORED]: Group "${rawGroupName}" not in whitelist.`);
                return;
            }
        }

        if (!senderNumber || senderNumber.length < 5) {
            console.log(`⚠️  [SKIP]: Invalid sender number from "${senderNumber}"`);
            return;
        }

        console.log(`\n--- 📥 New Message Event ---`);
        console.log(`From: ${contact.pushname || 'User'} (@${senderNumber})`);
        console.log(`Group: "${rawGroupName}"`);
        console.log(`Content: ${msg.body.substring(0, 50)}...`);

        // Process message immediately — no buffering/debounce
        await handleBufferedMessages([msg], senderNumber, pushName, rawGroupName);

    } catch (err) {
        console.error('🛑 [EVENT RECEIVE ERROR]:', err && err.stack ? err.stack : err);
    }
});


async function handleBufferedMessages(messages, senderNumber, pushName, rawGroupName) {
    const lastMsg = messages[messages.length - 1];
    
    // Centralized helper to tag the user in group replies
    const reply = async (text) => {
        const prefix = `*@${pushName}:*\n`;
        return lastMsg.reply(prefix + text);
    };

    try {
        let combinedBodyParts = [];
        for (const msg of messages) {
            const caption = msg.body?.trim() || '';
            let body = caption;

            if (msg.hasMedia) {
                try {
                    const media = await msg.downloadMedia();
                    if (media) {
                        const isAudio = media.mimetype.startsWith('audio') || media.mimetype.includes('ogg');
                        const isImage = media.mimetype.startsWith('image');

                        if (isAudio) {
                            console.log(`🎙️  [VOICE]: Transcribing from ${senderNumber}...`);
                            const res = await getNativeModel().generateContent([
                                { text: 'Transcribe this audio message exactly. Return only the transcribed text, nothing else.' },
                                { inlineData: { data: media.data, mimeType: media.mimetype } }
                            ]);
                            body = res.response.text().trim();

                        } else if (isImage) {
                            console.log(`📸 [IMAGE]: Processing from ${senderNumber}... caption="${caption || 'none'}"`);

                            const captionHint = caption
                                ? `The user also wrote this caption with the image: "${caption}". Use both the image and caption together.`
                                : '';

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

                            const res = await getNativeModel().generateContent({
                                contents: [
                                    {
                                        role: 'user',
                                        parts: [
                                            {
                                                 text: `This is a handwritten order slip/image from a Paint & Hardware wholesale shop.
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
- "xtra" or "xts" or "xto" -> "Extra"
- "enamel" or "ennamel" or "enamml" -> "Enamel"
- "Stanles" or "Stanl" -> "Stainless"
- "W/S" -> "Weather Shield"

6. TRADING NAME / SHOP NAME:
- Check for shop/customer name written at the top (e.g. "society Paint PECHS", "Nadeem colle").

Extract all items into the JSON schema, splitting shorthand entries into separate items (one item per size). Do not include zero-quantity items.
${captionHint}`
                                             },
                                             { inlineData: { data: media.data, mimeType: media.mimetype } }
                                         ]
                                     }
                                 ],
                                 generationConfig: {
                                     responseMimeType: 'application/json',
                                     responseSchema: schema
                                 }
                             });

                            const imageText = res.response.text().trim();
                            try {
                                const parsed = JSON.parse(imageText);
                                let formatted = '';
                                if (parsed.trading_name) {
                                    formatted += `Trading Name: ${parsed.trading_name}\n`;
                                }
                                if (parsed.items && parsed.items.length > 0) {
                                    formatted += `Items:\n`;
                                    parsed.items.forEach(item => {
                                        const qty = item.quantity || 1;
                                        const size = item.size ? ` ${item.size}` : '';
                                        formatted += `- ${item.product}${size} | Qty: ${qty}\n`;
                                    });
                                }
                                body = formatted.trim() || caption;
                                if (caption && !body.toLowerCase().includes(caption.toLowerCase())) {
                                    body = `${body}\nUser note: ${caption}`;
                                }
                            } catch (parseErr) {
                                console.error('🛑 [IMAGE JSON PARSE ERROR]:', parseErr.message);
                                body = imageText || caption;
                            }
                            console.log(`🖼️  [IMAGE EXTRACTED FOR AI]:\n${body}`);
                        }
                    }
                } catch (mediaErr) {
                    console.error('🛑 [MEDIA ERROR]:', mediaErr.message);
                    body = caption;
                }
            }

            if (body && body.trim().length >= 2) {
                combinedBodyParts.push(body.trim());
            }
        }

        const body = combinedBodyParts.join('\n\n').trim();
        if (!body || body.length < 2) return;

        // ── SESSION INIT ──────────────────────────────────────────────
        if (!chatSessions[senderNumber]) {
            chatSessions[senderNumber] = {
                history: [],
                turnStarts: [],
                verifiedProducts: {},
                lastMessageTimestamp: Date.now(),
                chatId: lastMsg.from,
                senderName: pushName,
                phoneNumber: senderNumber,
                groupName: rawGroupName,
                orderSubmitted: false
            };
        }
        const session = chatSessions[senderNumber];
        session.lastMessageTimestamp = Date.now();
        session.chatId = lastMsg.from;
        session.groupName = rawGroupName;
        session.senderName = pushName;

        // ── CANCEL DETECTION (AI se pehle — fast, no token waste) ─────
        const CANCEL_KEYWORDS = [
            'cancel', 'band karo', 'band kardo', 'rehne do', 'rehnedo',
            'choro', 'chordo', 'mat karo', 'nahi chahiye', 'nahin chahiye',
            'order cancel', 'cancel order', 'rok do', 'rokdo',
            'chor do', 'chordo', 'nahi karna', 'nahin karna','ignore','Ignore','cancl','cncl','khatam kardo','leave','leaveit'
        ];
        const bodyLower = body.toLowerCase();
        const isCancelRequest = CANCEL_KEYWORDS.some(kw => bodyLower.includes(kw));

        if (isCancelRequest && session.history.length > 0) {
            // Active order session hai aur cancel keh raha hai
            console.log(`🚫 [CANCEL]: @${senderNumber} cancelled their order.`);
            delete chatSessions[senderNumber];
            await reply('❌ *Order Cancel Ho Gaya.*\nAapka order cancel kar diya gaya hai Apna Khayal Rekhein.');
            return;
        }

        // ── BUILD AGENT INPUT ─────────────────────────────────────────
        // Pehle user ka message session history me save karein
        const turnStartIndex = session.history.length;
        session.history.push({ role: 'user', content: body });
        const agentInput = session.history;

        // ── RUN AGENT (agent session mein cache hota hai) ────────────
        if (!session.agent) {
            const sessionTools = createTools(session);
            session.agent = createOrderAgent(sessionTools);
            console.log(`🤖 [AGENT]: New agent created for ${senderNumber}`);
        }
        const orderAgent = session.agent;

        console.log(`💬 [MSG]: ${senderNumber} — "${body.substring(0, 60)}"`);

        stats.total++;
        const result = await run(orderAgent, agentInput, { maxTurns: 20 });
        const output = (result.finalOutput || '').trim();

        if (!output) return;

        // ── IGNORE ────────────────────────────────────────────────────
        if (output.startsWith('IGNORE_CHAT')) {
            stats.ignored++;
            if (session.history.length === 0) {
                // Pehla message tha aur general chat — bilkul ignore karo
                console.log(`⏭️  [IGNORE_CHAT]: ${senderNumber} — fresh general message, skipping.`);
                delete chatSessions[senderNumber];
            } else {
                // ⚠️ Mid-order mein IGNORE_CHAT — yeh nahi hona chahiye
                // Code-level safeguard: user se poochein kya chahiye
                console.log(`⚠️  [IGNORE_CHAT mid-session]: ${senderNumber} — AI ignored mid-order msg. Asking clarification.`);
                await reply('Order mn correction h ? Ya cancel karna h.');
            }
            return;
        }

        console.log(`📤 [SALESBOT]: ${output.substring(0, 150)}`);

        // ── ORDER SAVED (via submitOrder tool, set directly on session) ─
        if (session.orderSubmitted) {
            await reply('✅ *Order Save Ho Gaya!*\nAapka order mehfooz kar liya gaya hai. Shukriya!');
            delete chatSessions[senderNumber];
            return;
        }

        // Tool reported a save failure — tell the customer plainly, keep
        // the session alive so they don't have to re-type the whole order.
        if (output.includes('ORDER_SAVE_FAILED')) {
            await reply('❌ *Error:* Order save karne mein kuch takneeki masla aaya hai. Meharbani karke thori dair baad dobara "YES" bhej kar koshish karein ya admin se raabta karein.');
            return;
        }

        // ── NORMAL REPLY ──────────────────────────────────────────────
        await reply(output);

        // ── HISTORY SAVE ──────────────────────────────────────────────
        if (result.newMessages && result.newMessages.length > 0) {
            // @openai/agents SDK — tool calls aur assistant replies append karein
            session.history = [...session.history, ...result.newMessages];
        } else {
            session.history.push(
                { role: 'assistant', content: output }
            );
        }

        // ── HISTORY TRIM (turn-safe) ────────────────────────────────────
        session.turnStarts.push(turnStartIndex);
        const MAX_TURNS = 8;
        if (session.turnStarts.length > MAX_TURNS) {
            const cutIndex = session.turnStarts[session.turnStarts.length - MAX_TURNS];
            session.history = session.history.slice(cutIndex);
            session.turnStarts = session.turnStarts
                .slice(-MAX_TURNS)
                .map(idx => idx - cutIndex);
        }

        stats.pending = Object.keys(chatSessions).filter(k => chatSessions[k]?.history?.length > 0).length;

    } catch (err) {
        console.error('🛑 [MESSAGE HANDLER ERROR]:', err && err.stack ? err.stack : err);
        try {
            // Reset/clear session history to recover from errors/loops
            if (typeof senderNumber !== 'undefined' && chatSessions[senderNumber]) {
                chatSessions[senderNumber].history = [];
                chatSessions[senderNumber].turnStarts = [];
            }
            await reply('⚠️ *Masla:* Message process karne mein zyada der lag rahi hai. Meharbani karke apna order wazeh aur saaf likh kar dobara bhejein.');
        } catch (replyErr) {
            console.error('🛑 [REPLY ERROR ON EXCEPTION]:', replyErr && replyErr.stack ? replyErr.stack : replyErr);
        }
    }
}

// ── PERIODIC TIMEOUT CHECK (Session Inactivity) ────────────────────────
// NOTE: this used to say "15 Minutes" in the comment but was actually set
// to 3 minutes in code — that mismatch was silently cancelling orders on
// customers who paused mid-conversation. Fixed to a single source of truth.
const SESSION_TIMEOUT_MINUTES = 8;
setInterval(async () => {
    if (clientStatus !== 'connected') return;

    const now = Date.now();
    const TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

    for (const [senderNumber, session] of Object.entries(chatSessions)) {
        if (session.history && session.history.length > 0) {
            const idleTime = now - (session.lastMessageTimestamp || now);
            if (idleTime >= TIMEOUT_MS) {
                console.log(`⏰ [TIMEOUT]: Session for @${senderNumber} idle for 3 mins. Clearing session.`);
                try {
                    const chatId = session.chatId;
                    if (chatId) {
                        await client.sendMessage(chatId, `⚠️ *@${senderNumber}:* Aap ka order 3 minute tak confirm na hone ki wajah se cancel kar diya gaya hai aur chat session clear ho gaya hai.`);
                    }
                } catch (err) {
                    console.error(`🛑 [TIMEOUT SEND ERROR] for @${senderNumber}:`, err.message);
                }
                delete chatSessions[senderNumber];
            }
        }
    }
}, 60 * 1000); // Check every 60 seconds (1 minute)

// ============================================================
// EXCEL WRITER
// ============================================================
async function writeToExcel(items, pushname, groupName, senderNumber, tradingName) {
    const HEADERS = [
        { header: 'S.No',         key: 'sno',     width: 6  },
        { header: 'Date',         key: 'date',    width: 22 },
        { header: 'Group',        key: 'group',   width: 20 },
        { header: 'Customer',     key: 'customer',width: 20 },
        { header: 'Phone',        key: 'phone',   width: 18 },
        { header: 'Trading Name', key: 'trading', width: 25 },
        { header: 'Product',      key: 'product', width: 45 },
        { header: 'Size',         key: 'size',    width: 12 },
        { header: 'Qty',          key: 'qty',     width: 8  },
        { header: 'Unit',         key: 'unit',    width: 10 },
        { header: 'NTF',          key: 'ntf',     width: 6  },
    ];

    try {
        const workbook = new ExcelJS.Workbook();
        let sheet;

        if (fs.existsSync(EXCEL_FILE)) {
            await workbook.xlsx.readFile(EXCEL_FILE);
            sheet = workbook.getWorksheet('Orders');
        }

        if (!sheet) {
            sheet = workbook.addWorksheet('Orders');
            sheet.columns = HEADERS;

            const headerRow = sheet.getRow(1);
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            headerRow.height = 20;
        } else {
            sheet.columns = HEADERS;
        }

        const cleanPhone = String(senderNumber).replace(/\D/g, '');

        // If there are already data rows in the sheet, add an empty row before the new order
        if (sheet.rowCount > 1) {
            sheet.addRow([]);
        }

        const startRowNumber = sheet.rowCount + 1;

        // Calculate a sequential Order Serial Number
        let lastSno = 0;
        ordersCache.forEach(o => {
            const num = parseInt(o['S.No']);
            if (!isNaN(num) && num > lastSno) {
                lastSno = num;
            }
        });
        const snoValue = lastSno + 1;

        items.forEach((item) => {
            const row = sheet.addRow({
                sno:      snoValue,
                date:     new Date().toLocaleString('en-PK'),
                group:    groupName,
                customer: pushname,
                phone:    cleanPhone,
                trading:  tradingName || '',
                product:  item.product,
                size:     item.size || '',
                qty:      item.quantity || 1,
                unit:     item.unit || '',
                ntf:      item.isNTF ? 'YES' : 'NO'
            });

            row.getCell('phone').value = cleanPhone;
            row.getCell('phone').numFmt = '@';

            if (item.isNTF) {
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                });
            }

            ordersCache.push({
                'S.No': snoValue,
                'Date': new Date().toLocaleString('en-PK'),
                'Group Name': groupName,
                'Customer Name': pushname,
                'Phone Number': cleanPhone,
                'Trading Name': tradingName || '',
                'Product Name': item.product,
                'Product Size': item.size,
                'Quantity (Pcs)': item.quantity,
                'Unit': item.unit,
                'NTF': item.isNTF ? 'YES' : 'NO'
            });
        });

        const endRowNumber = sheet.rowCount;
        if (endRowNumber > startRowNumber) {
            // Merge metadata columns (S.No, Date, Group, Customer, Phone, Trading Name)
            const colsToMerge = [1, 2, 3, 4, 5, 6];
            colsToMerge.forEach(colIndex => {
                sheet.mergeCells(startRowNumber, colIndex, endRowNumber, colIndex);
                const cell = sheet.getCell(startRowNumber, colIndex);
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });
        } else if (endRowNumber === startRowNumber) {
            // Apply alignment to metadata columns even for single-item orders for consistency
            const colsToMerge = [1, 2, 3, 4, 5, 6];
            colsToMerge.forEach(colIndex => {
                const cell = sheet.getCell(startRowNumber, colIndex);
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });
        }

        await workbook.xlsx.writeFile(EXCEL_FILE);
        console.log(`✅ [EXCEL]: Saved ${items.length} item(s) for ${pushname}`);
    } catch (e) {
        console.error('🛑 [EXCEL ERROR]:', e.message);
        throw e;
    }
}

// ============================================================
// HELPERS
// ============================================================
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================================
// WHATSAPP INIT
// ============================================================
client.initialize();

// ============================================================
// REST API
// ============================================================
app.get('/api/stats', (req, res) => res.json({
    ...stats,
    activeSessions: Object.keys(chatSessions).length
}));

app.get('/api/orders', (req, res) => res.json(ordersCache));

app.get('/api/orders/ntf', (req, res) =>
    res.json(ordersCache.filter(o => o.NTF === 'YES'))
);

app.get('/api/qr', async (req, res) => {
    const payload = { status: clientStatus };
    if (clientStatus === 'qr_ready' && qrCodeData) {
        payload.qr = await QRCode.toDataURL(qrCodeData);
    }
    res.json(payload);
});

app.post('/api/system/start', (req, res) => {
    if (clientStatus === 'stopped') {
        client.initialize();
        res.json({ message: 'Starting WhatsApp client...' });
    } else {
        res.json({ message: `Already ${clientStatus}` });
    }
});

app.delete('/api/sessions/:number', (req, res) => {
    const num = req.params.number;
    if (chatSessions[num]) {
        delete chatSessions[num];
        res.json({ message: `Session cleared for ${num}` });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

app.get('/api/sessions', (req, res) => {
    const sessions = Object.entries(chatSessions).map(([num, s]) => ({
        number: num,
        name: s.senderName || 'Customer',
        messageCount: s.history.length,
        verifiedProducts: Object.keys(s.verifiedProducts || {}).length
    }));
    res.json(sessions);
});

app.get('/api/download', (req, res) => {
    if (fs.existsSync(EXCEL_FILE)) res.download(EXCEL_FILE);
    else res.status(404).json({ error: 'No orders file yet' });
});

app.post('/api/orders/clear', (req, res) => {
    try {
        console.log('🧹 [SYSTEM]: Received request to clear all data...');
        ordersCache = [];
        stats = { total: 0, orders: 0, pending: 0, ignored: 0 };
        Object.keys(chatSessions).forEach(key => delete chatSessions[key]);

        if (fs.existsSync(EXCEL_FILE)) {
            fs.unlinkSync(EXCEL_FILE);
            console.log('🗑️  [SYSTEM]: orders.xlsx deleted.');
        }

        console.log('✅ [SYSTEM]: All orders, stats, and sessions cleared.');
        res.json({ message: 'All orders and logs cleared successfully.' });
    } catch (err) {
        console.error('🛑 [CLEAR ERROR]:', err.message);
        res.status(500).json({ error: 'Failed to clear orders.' });
    }
});

app.listen(PORT, '0.0.0.0', () =>
    console.log(`\n🚀 Sales Agent Bridge running on port ${PORT}\n`)
);
