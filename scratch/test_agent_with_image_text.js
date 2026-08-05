const { Agent, run, OpenAIChatCompletionsModel, setTracingDisabled, tool } = require('@openai/agents');
const OpenAI = require('openai');
const { findBestProductMatchLocal, bulkVerifyProductsLocal } = require('../productSearch');
require('dotenv').config();

setTracingDisabled(true);

const apiKey = process.env.GEMINI_API_KEY;
const geminiOpenAIClient = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});
const geminiModel = new OpenAIChatCompletionsModel(geminiOpenAIClient, 'gemini-3.5-flash-lite');

// Mock session
const session = {
  history: [],
  turnStarts: [],
  verifiedProducts: {},
  senderName: 'Test Customer',
  groupName: 'Test Group',
  phoneNumber: '923001234567',
  orderSubmitted: false
};

// Replicate createTools
function createTools(session) {
    const sessionCache = session.verifiedProducts;

    const matchTool = tool({
        name: 'findBestProductMatch',
        description: 'REQUIRED before every product confirmation.',
        parameters: require('zod').object({
            nameOrCode: require('zod').string(),
            requestedSize: require('zod').string(),
            wantNoToken: require('zod').boolean().optional()
        }),
        execute: async ({ nameOrCode, requestedSize, wantNoToken }) =>
            findBestProductMatchLocal(nameOrCode, requestedSize, wantNoToken, sessionCache, session.phoneNumber)
    });

    const bulkVerifyTool = tool({
        name: 'bulkVerifyProducts',
        description: 'Verify multiple products 3 times only. Use when order has 2+ items.',
        parameters: require('zod').object({
            items: require('zod').array(require('zod').object({
                nameOrCode: require('zod').string(),
                requestedSize: require('zod').string(),
                wantNoToken: require('zod').boolean().optional()
            }))
        }),
        execute: async ({ items }) => {
            const results = bulkVerifyProductsLocal(items, sessionCache, session.phoneNumber);
            return JSON.stringify(results);
        }
    });

    const submitOrderTool = tool({
        name: 'submitOrder',
        description: 'Call this ONLY once, when every item is a confirmed MATCH, the trading name is known, and the customer has confirmed.',
        parameters: require('zod').object({
            items: require('zod').array(require('zod').object({
                product: require('zod').string(),
                size: require('zod').string(),
                quantity: require('zod').number(),
                unit: require('zod').string().optional()
            })),
            tradingName: require('zod').string()
        }),
        execute: async ({ items, tradingName }) => {
            session.orderSubmitted = true;
            return 'ORDER_SAVED_OK';
        }
    });

    return [matchTool, bulkVerifyTool, submitOrderTool];
}

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
     * "requestedSize" me sirf clean size unit (Gallon/Drum/Quarter ya G/D/Q). Kabhi quantity mix na karein.
     * "nameOrCode" me brand + product + code + color pass karein. Color ho toh zaroor include karein. Size/qty kabhi mix na karein.
     * CODE vs QUANTITY: number + size word (gln/drum/qtr/g/d/q) = QUANTITY. Number alone or with 'no'/'code' = CODE.
     * Examples:
       - "2 no k 2 gln"   → code="2", qty=2, size=Gallon
       - "bold 55 2 drum" → code="55", qty=2, size=Drum
       - "extra semi white 3 gln" → no code, qty=3, size=Gallon
     * Agar number code hai ya qty — genuinely unsure ho toh ek short line mein poocho.

3. BRAND NAMES & SPELLING / TYPOS AUTO-CORRECTION:

   KNOWN BRANDS:
   EXTRA, TREND, BOLD, BUDGET, EXCLUSIVE, FLUORESCENT, ALTRA, BONDEX,
   NIPPON, BERGER, HI, HI LOOK, FAME, KLICK, SATIN, HEAT, TIMBER, WOOD, WOODCOAT, TURPENTINE

   BRAND TYPO RULE — Aap khud brand match karein (AI level):
   User jo bhi brand ka naam ya shorthand likhe, upar diye KNOWN BRANDS se match karke normalize karein aur Tool ko corrected brand name pass karein.
   Examples:
     'ext', 'etra', 'erta', 'extr', 'xtra', 'exta' → EXTRA
     'excl', 'exclucv', 'exclsive', 'exclusv'       → EXCLUSIVE
     'fluro', 'florescent', 'flourescent'            → FLUORESCENT
     'alta', 'altr'                                  → ALTRA
     'bndx', 'bndex', 'bondx'                        → BONDEX
     'bdgt', 'budgt'                                 → BUDGET
     'trnd', 'trendd'                                → TREND

   PRODUCT SHORTHAND ALIASES:
     'lapy'/'laapi'/'lapi' → PUTTY | 'w/s'/'ws' → WEATHER SHIELD | 'w/b'/'wb' → WATER BASE | 'eml'/'enl' → SEMI

   Example: user writes "exclucv semi white 2g" →
     nameOrCode = "EXCLUSIVE SEMI WHITE", requestedSize = "Gallon"

4. TOOL RESULTS & CORRECTIONS — Har issue wale item ko Roman Urdu mein dikhayein:
   - Use bold numbering (*Item 1:*, *Item 2:*).
   - CRITICAL FORMATTING: Multi-item response mein har item ke baad ek BLANK LINE (empty line) zaroor dalein taake har item alag aur clearly readable ho. Items ko kabhi bhi ek ke baad directly mat likho.
   - MATCH → official name use karo, koi clarification nahi.
   - MULTIPLE_MATCHES → pehle context check karo. Agar context se clear ho, auto select karo. Warna AMBIGUOUS format mein convert karo.
   - AMBIGUOUS → "*Item [N]:* (IN-Complete INFO) - [Item] ke liye details adhuri hain. Kya aap inme se chahte hain?\\n[options list]"
   - SIZE_NOT_AVAILABLE → "*Item [N]:* - [Item] mein requested size nahi hai. Available: [sizes]. Kaunsa chahiye?"
   - NOT_IN_DATABASE → "*Item [N]:* - [Item/Code] database mein nahi mila. Spelling check karein ya code batayein."
   - NO_TOKEN_NOT_AVAILABLE → "*Item [N]:* - [Item] bagher token available nahi. Token ke saath chahiye ya cancel?"

5. MISSING INFO — KABHI BHI assume ya guess mat karo:
   - QTY missing → "Qty batayein: [Product] ki kitni quantity chahiye?" — qty ke bina proceed NAHI karna.
   - BRAND missing (ambiguous code) → Tool AMBIGUOUS return karega → "Brand batayein: [Code] kai brands mein hai — konsa chahiye? [options]"
   - SIZE missing → "Size batayein: [Product] ke liye Gallon / Drum / Quarter?"
   - Ek message mein sirf ek cheez poochein. Agar qty bhi missing aur brand bhi — pehle brand, phir qty.

6. TRADING NAME rules:
   - User ka trading/shop name KABHI BHI product tools mein pass mat karo.
   - Words jaise 'Traders', 'Paint', 'Store', 'Shop', 'Enterprises', 'Co' wale naam = trading_name.
   - Har order ke liye trading/shop name ka hona lazmi hai. Agar user ne order ya image ke sath trading name nahi bataya, toh aap hamesha sabse pehle unse poochein: "Meharbani karke apni shop ya trading name batayein?". Trading name ke bina order list confirm ya submit nahi ho sakti.
   - CRITICAL SAFEGUARD: Aap kabhi bhi khud se "UNKNOWN", "Customer", "pushName", ya koi bhi generic/random trading name nahi maan sakte. Agar aapko wazeh taur par shop name nahi pata, toh aapko har haal mein user se shop name poochhna hi poochhna hai.

7. FINAL LIST — Sirf tab dikhao jab SARE items MATCH hon aur TRADING NAME bhi mil jaye:
   - CRITICAL: [Product] mein exact tool-returned name use karo including size suffix (-D/-G/-Q/-DX/-GX). Kabhi modify mat karo.
   - CRITICAL FLOW: Aapko hamesha pehle user ko final list show karni hai aur unka confirmation lena hai. Kabhi bhi automatically submitOrder tool call mat karein bina final list dikhaye aur user ki haan (YES/OK) liye.
   - MANDATORY TURN SEPARATION: Aapko final list show karne wale turn/message mein 'submitOrder' tool call karna STRICTLY FORBIDDEN hai. Aapko pehle sirf final list dikhani hai aur user ke agle message ka wait karna hai. Jab unka agla message confirm (YES/OK) kare, tabhi sirf agle turn mein 'submitOrder' call karna hai.
   Format:
   Trading Name: [Trading Name]
   
   1. [Product] | [Size] | [Qty]

   Example:
   Trading Name: Society Paints
   
   1. EXTRA ENAMEL 66 BLACK-Q | Qtr | 2
   2. EXTRA ENAMEL 316 SHARP BROWN-G | Gln | 3

   Phir poochein: "Yeh list check karlein, theek hai toh YES likh kar confirm kardein. ✅"

8. ON CONFIRMATION (YES/OK/HAAN/G/DONE/CONFIRM) — submitOrder tool call karo:
   - Jab user list ko confirm kare (e.g., YES, OK, HAAN bhej kar), tabhi sirf aur sirf 'submitOrder' tool call karein.
   - Trading name aur exact product names (with suffix) pass karo.
   - Tool success ke baad ek short Roman Urdu line mein confirm karo. Tool dobara call mat karo.
   - Tool fail ho → customer ko bolo technical masla aaya, thodi dair baad YES bhejein.`;

const userMsg = `Items:
- 9992 Gallon | Qty: 2
- 9971 Quarter | Qty: 2
- 8823 Gallon | Qty: 1
- 8823 Quarter | Qty: 2
- 9988 Gallon | Qty: 2
- 9997 Quarter | Qty: 2
- 8838 Gallon | Qty: 1
- 8838 Quarter | Qty: 2
- Bold 9956 Gallon | Qty: 2
- Bold 9962 Quarter | Qty: 2
- Bold 8826 Gallon | Qty: 1
- Bold 9959 Gallon | Qty: 2
- Bold Putty Gallon | Qty: 4
- Bold 8801 Gallon | Qty: 1
- Bold 8801 Quarter | Qty: 2
- Bold 9999 Gallon | Qty: 5
- Bold 8827 Quarter | Qty: 2
- Bold 8803 Gallon | Qty: 1
- Bold 8803 Quarter | Qty: 2
- Bold 8832 Gallon | Qty: 1
- Bold 8832 Quarter | Qty: 2
- Extra 303 Gallon | Qty: 2
- Extra 47 Gallon | Qty: 2
- Extra 45 Gallon | Qty: 1
- Extra 301 Gallon | Qty: 1
- Extra 60 Gallon | Qty: 2
- Exclusive 502 Gallon | Qty: 2
- Exclusive 502 Quarter | Qty: 2
- Exclusive 519 Gallon | Qty: 1
- Exclusive 528 Quarter | Qty: 2
- Exclusive 518 Quarter | Qty: 2
- Exclusive 517 Quarter | Qty: 2
- Exclusive 509 Quarter | Qty: 2
- Exclusive 536 Quarter | Qty: 2`;

async function testAgent() {
  console.log('🤖 [AGENT TEST]: Starting test of Agent with extracted testing.jpeg order text...\n');
  const agentTools = createTools(session);
  const agent = new Agent({
    name: 'SalesBot',
    model: geminiModel,
    tools: agentTools,
    instructions: SALESBOT_INSTRUCTIONS
  });

  session.history.push({ role: 'user', content: userMsg });
  const result = await run(agent, session.history, { maxTurns: 10 });
  
  console.log('\n====== AGENT RESPONSE ======');
  console.log(result.finalOutput);
  console.log('============================\n');
}

testAgent();
