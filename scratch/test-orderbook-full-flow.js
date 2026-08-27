const { Agent, run, OpenAIChatCompletionsModel, setTracingDisabled, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
const { findBestProductMatchLocal, bulkVerifyProductsLocal } = require('../productSearch');
const fs = require('fs');
require('dotenv').config();

setTracingDisabled(true);

const apiKey = process.env.GEMINI_API_KEY;
const geminiOpenAIClient = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});
const geminiModel = new OpenAIChatCompletionsModel(geminiOpenAIClient, 'gemini-2.5-flash');

const serverCode = fs.readFileSync('whatsapp-server.js', 'utf8');
const match = serverCode.match(/const SALESBOT_INSTRUCTIONS = `([\s\S]*?)`;/);
const SALESBOT_INSTRUCTIONS = match[1];

const sessionCache = {};

const matchTool = tool({
    name: 'findBestProductMatch',
    description: `REQUIRED before every product confirmation.`,
    parameters: z.object({
        nameOrCode: z.string(),
        requestedSize: z.string(),
        wantNoToken: z.boolean().optional()
    }),
    execute: async ({ nameOrCode, requestedSize, wantNoToken }) => {
        const res = findBestProductMatchLocal(nameOrCode, requestedSize, wantNoToken, sessionCache);
        return res;
    }
});

const bulkVerifyTool = tool({
    name: 'bulkVerifyProducts',
    description: `Verify multiple products.`,
    parameters: z.object({
        items: z.array(z.object({
            nameOrCode: z.string(),
            requestedSize: z.string(),
            wantNoToken: z.boolean().optional()
        }))
    }),
    execute: async ({ items }) => {
        const res = bulkVerifyProductsLocal(items, sessionCache);
        return JSON.stringify(res);
    }
});

const submitOrderTool = tool({
    name: 'submitOrder',
    description: `Save order.`,
    parameters: z.object({
        items: z.array(z.object({
            product: z.string(),
            size: z.string(),
            quantity: z.number()
        })),
        tradingName: z.string()
    }),
    execute: async ({ items, tradingName }) => {
        console.log(`\n🎉 [SUBMIT ORDER CALLED SUCCESSFULLY]`);
        console.log(`Trading Name: ${tradingName}`);
        console.log(`Items (${items.length}):`, JSON.stringify(items, null, 2));
        return 'ORDER_SAVED_OK';
    }
});

const agent = new Agent({
    name: 'SalesBot',
    model: geminiModel,
    tools: [matchTool, bulkVerifyTool, submitOrderTool],
    instructions: SALESBOT_INSTRUCTIONS
});

async function runFlow() {
    console.log("====================================================");
    console.log("🧪 TESTING FULL ORDERBOOK FLOW (Image OCR -> User Clarification)");
    console.log("====================================================\n");

    const visionExtractedText = `Items:
- 9007 Gallon | Qty: 10
- 9059 Gallon | Qty: 3
- 9072 Gallon | Qty: 1
- 9073 Gallon | Qty: 1
- 8767 Gallon | Qty: 4
- Extra Enamel 66 Black Gallon | Qty: 1
- 49 Gallon | Qty: 1
- Extra Enamel 336 Gallon | Qty: 1
- 8775 Gallon | Qty: 1
- Extra Semi 03 White Gallon | Qty: 1
- Extra W/S 3162 Silvery Gallon | Qty: 1
- Extra Putty Gallon | Qty: 5
- W331 Clear Varnish Pail | Qty: 1`;

    let history = [];
    
    console.log("Step 1: User sends image OCR text");
    history.push({ role: 'user', content: visionExtractedText });
    let res1 = await run(agent, history, { maxTurns: 10 });
    console.log(`\n🤖 Bot Response 1:\n${res1.finalOutput}\n`);
    if (res1.newMessages) history = [...history, ...res1.newMessages];
    else history.push({ role: 'assistant', content: res1.finalOutput });

    console.log("\nStep 2: User provides shop name: Subhan Paint");
    history.push({ role: 'user', content: "Shop name Subhan Paint hai" });
    let res2 = await run(agent, history, { maxTurns: 10 });
    console.log(`\n🤖 Bot Response 2:\n${res2.finalOutput}\n`);
    if (res2.newMessages) history = [...history, ...res2.newMessages];
    else history.push({ role: 'assistant', content: res2.finalOutput });

    console.log("\nStep 3: User confirms list: YES");
    history.push({ role: 'user', content: "YES" });
    let res3 = await run(agent, history, { maxTurns: 10 });
    console.log(`\n🤖 Bot Response 3:\n${res3.finalOutput}\n`);
}

runFlow();
