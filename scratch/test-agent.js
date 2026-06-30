const { Agent, run, OpenAIChatCompletionsModel, setTracingDisabled, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
const { findBestProductMatchLocal, bulkVerifyProductsLocal } = require('../productSearch');
require('dotenv').config();

setTracingDisabled(true);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No GEMINI_API_KEY found in environment!");
    process.exit(1);
}

const geminiOpenAIClient = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});
const geminiModel = new OpenAIChatCompletionsModel(geminiOpenAIClient, 'gemini-2.5-pro');

// Load instructions from whatsapp-server.js
const fs = require('fs');
const serverCode = fs.readFileSync('whatsapp-server.js', 'utf8');
const match = serverCode.match(/const SALESBOT_INSTRUCTIONS = `([\s\S]*?)`;/);
if (!match) {
    console.error("Could not extract SALESBOT_INSTRUCTIONS!");
    process.exit(1);
}
const SALESBOT_INSTRUCTIONS = match[1];

const sessionCache = {};
const matchTool = tool({
    name: 'findBestProductMatch',
    description: `REQUIRED before every product confirmation.
Pass wantNoToken=true if user says "TX" or "bagher token or DX/GX/QX".
Enforces strict exact code matching (e.g. 5055 does NOT match 55; non-existent codes return NOT_IN_DATABASE).
Enforces brand requirement for codes in multiple brands (e.g., DD41 exists in Altra and Hi; returns AMBIGUOUS if brand is missing in query).
Enforces strict field matching for queries without codes (returns AMBIGUOUS if brand, product, or color is omitted and multiple database variants exist).
Tool returns: MATCH / MULTIPLE_MATCHES / AMBIGUOUS / LOW_CONFIDENCE / SIZE_NOT_AVAILABLE / NOT_IN_DATABASE / NO_TOKEN_NOT_AVAILABLE`,
    parameters: z.object({
        nameOrCode: z.string().describe("Product name ya code (e.g., 'EXTRA WHITE PUTTY', 'DA45'). Isme size ya quantity include mat karein."),
        requestedSize: z.string().describe("Sirf requested size/unit (e.g., 'Gallon', 'Drum', 'Quarter', 'G', 'D', 'Q'). Quantity numbers (jaise '2' ya '5') isme include nahi hone chahiye."),
        wantNoToken: z.boolean().optional()
    }),
    execute: async ({ nameOrCode, requestedSize, wantNoToken }) => {
        console.log(`[TOOL CALL]: findBestProductMatch(nameOrCode="${nameOrCode}", requestedSize="${requestedSize}", wantNoToken=${wantNoToken})`);
        const res = findBestProductMatchLocal(nameOrCode, requestedSize, wantNoToken, sessionCache);
        console.log(`[TOOL RESPONSE]: ${res}`);
        return res;
    }
});

const agent = new Agent({
    name: 'SalesBot',
    model: geminiModel,
    tools: [matchTool],
    instructions: SALESBOT_INSTRUCTIONS
});

async function test() {
    console.log("Starting Agent test...");
    const inputs = [
        "extra 2 no k 2 gln"
    ];
    
    let history = [];
    for (const input of inputs) {
        console.log(`\nUser: ${input}`);
        history.push({ role: 'user', content: input });
        const result = await run(agent, history, { maxTurns: 10 });
        console.log(`Agent: ${result.finalOutput}`);
        history = [...history, ...result.newMessages];
    }
}

test();
