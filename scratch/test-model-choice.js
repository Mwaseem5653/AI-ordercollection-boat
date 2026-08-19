const { Agent, run, OpenAIChatCompletionsModel, setTracingDisabled, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
require('dotenv').config();

setTracingDisabled(true);

const apiKey = process.env.GEMINI_API_KEY;
const geminiOpenAIClient = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});

async function testModel(modelName) {
    console.log(`Testing model: ${modelName}`);
    const model = new OpenAIChatCompletionsModel(geminiOpenAIClient, modelName);

    const submitOrderTool = tool({
        name: 'submitOrder',
        description: 'Call when order is confirmed.',
        parameters: z.object({
            tradingName: z.string(),
            items: z.array(z.object({
                product: z.string(),
                size: z.string(),
                quantity: z.number()
            }))
        }),
        execute: async ({ tradingName, items }) => {
            console.log(`[EXECUTED TOOL submitOrder]: tradingName=${tradingName}, items=${items.length}`);
            return 'ORDER_SAVED_OK';
        }
    });

    const agent = new Agent({
        name: 'SalesBot',
        model: model,
        tools: [submitOrderTool],
        instructions: 'You are SalesBot. When the user confirms an order, call the submitOrder tool. Do NOT print code.'
    });

    const result = await run(agent, [
        { role: 'user', content: 'Confirm order for Society Paints: 2 Gallons Extra Semi White' },
        { role: 'assistant', content: 'Trading Name: Society Paints\n1. EXTRA SEMI WHITE | Gallon | 2\nYeh list check karlein, theek hai toh YES likh kar confirm kardein.' },
        { role: 'user', content: 'YES' }
    ]);

    console.log(`Final Output: ${result.finalOutput}`);
}

async function runTests() {
    await testModel('gemini-2.0-flash');
}
runTests();
