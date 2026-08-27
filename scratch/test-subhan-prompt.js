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
        console.log(`[TOOL matchTool]: nameOrCode="${nameOrCode}", size="${requestedSize}"`);
        const res = findBestProductMatchLocal(nameOrCode, requestedSize, wantNoToken, sessionCache);
        console.log(`  -> ${res}`);
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
        console.log(`[TOOL bulkVerify]: ${items.length} items`);
        const res = bulkVerifyProductsLocal(items, sessionCache);
        console.log(`  -> ${JSON.stringify(res)}`);
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
            quantity: z.number(),
            unit: z.string().optional()
        })),
        tradingName: z.string()
    }),
    execute: async ({ items, tradingName }) => {
        console.log(`[TOOL submitOrder]: tradingName=${tradingName}, items=${JSON.stringify(items, null, 2)}`);
        return 'ORDER_SAVED_OK';
    }
});

const agent = new Agent({
    name: 'SalesBot',
    model: geminiModel,
    tools: [matchTool, bulkVerifyTool, submitOrderTool],
    instructions: SALESBOT_INSTRUCTIONS
});

async function runTest() {
    const userMsg = `Trading Name: Subhan Paint
1. 9007-G | Gallon | 10
2. 9059-G | Gallon | 3
3. 9072-G | Gallon | 1
4. 9073-G | Gallon | 1
5. 8767-G | Gallon | 4
6. EXTRA ENAMEL 66 BLACK-G | Gallon | 1
7. 49-G | Gallon | 1
8. EXTRA ENAMEL 336 C
9. 8775-G | Gallon | 1
10. EXTRA SEMI 03 WHIT11. EXTRA W/S 3162 SILVERY-G | Gallon | 1
12. Extra Putty-G | Gallon | 5
13. W331 CLEAR VARNISH 3 LTR-G`;

    console.log(`--- USER MESSAGE --- \n${userMsg}\n`);
    const res = await run(agent, [{ role: 'user', content: userMsg }], { maxTurns: 10 });
    console.log(`\n--- AGENT FINAL OUTPUT --- \n${res.finalOutput}`);
}

runTest();
