require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const path = require('path');
const memory = require('./memory.js');
const { webSearch, geminiTools } = require('./tools.js');

const app = express();
const PORT = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "You are an AI assistant for software development. When asked for up-to-date information, use the web search tool.",
    tools: geminiTools
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/ask', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).send({ error: 'Prompt is required' });

    try {
        const history = (await memory.getHistory()).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const functionCalls = response.functionCalls;

        // --- CORRECTED LOGIC FOR FUNCTION CALLS ---
        // Check if the array exists AND has items in it
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === 'webSearch') {
                const query = call.args.query;
                const toolResult = await webSearch(query);

                const result2 = await chat.sendMessage([
                    {
                        functionResponse: {
                            name: 'webSearch',
                            response: {
                                name: 'webSearch',
                                content: toolResult,
                            },
                        },
                    },
                ]);
                const finalResponse = result2.response.text();
                await memory.addMessage({ role: 'user', content: prompt });
                await memory.addMessage({ role: 'assistant', content: finalResponse });
                return res.send({ response: finalResponse });
            }
        }
        
        // --- HANDLE NORMAL TEXT RESPONSE ---
        const text = response.text();
        await memory.addMessage({ role: 'user', content: prompt });
        await memory.addMessage({ role: 'assistant', content: text });
        res.send({ response: text });

    } catch (error) {
        console.error('Error calling Gemini:', error);
        res.status(500).send({ error: 'Failed to communicate with AI' });
    }
});

async function startServer() {
    await memory.initializeMemory();
    app.listen(PORT, () => console.log(`Server is listening on http://localhost:${PORT}`));
}

startServer();