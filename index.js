require('dotenv').config();
const express = require('express');
// We no longer need FunctionCallingMode, so the import is simpler
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const path = require('path');
const memory = require('./memory.js');
const tools = require('./tools.js');

const app = express();
const PORT = process.env.PORT || 3000;

// --- INITIALIZE THE GEMINI CLIENT (REVERTED TO DEFAULT TOOL CONFIG) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: "You are an expert AI assistant for software development. You can read and write files, and search the web. You can perform multi-step tasks by calling tools sequentially. If a tool is not suitable for the user's request, respond directly.",
    tools: tools.geminiTools
    // The toolConfig block has been removed to restore the default "AUTO" behavior
});

// The rest of your index.js file remains exactly the same...
// ---SETUP MIDDLEWARE---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---API ROUTES---
app.post('/ask', async (req, res) => {
    const { prompt, sessionId } = req.body;
    if (!prompt) return res.status(400).send({ error: 'Prompt is required' });

    try {
        const rawHistory = await memory.getHistory(sessionId);
        
        let sanitizedHistory = [];
        let lastRole = null;
        for (const msg of rawHistory) {
            if ((msg.role === 'user' || msg.role === 'assistant') && msg.role !== lastRole) {
                sanitizedHistory.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }],
                });
                lastRole = msg.role;
            }
        }
        if (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') {
            sanitizedHistory.shift();
        }

        const chat = model.startChat({ history: sanitizedHistory });
        let result = await chat.sendMessage(prompt);

        while (true) {
            const response = result.response;
            const functionCalls = response.functionCalls;

            if (!functionCalls || functionCalls.length === 0) {
                const finalResponse = response.text();
                await memory.addMessage(sessionId, { role: 'user', content: prompt });
                await memory.addMessage(sessionId, { role: 'assistant', content: finalResponse });
                return res.send({ response: finalResponse });
            }

            const call = functionCalls[0];
            let toolResult;

            switch (call.name) {
                case 'webSearch':
                    toolResult = await tools.webSearch(call.args.query);
                    break;
                case 'readFile':
                    toolResult = await tools.readFile(call.args.filePath);
                    break;
                case 'writeFile':
                    toolResult = await tools.writeFile(call.args.filePath, call.args.content);
                    break;
                case 'listFiles':
                    toolResult = await tools.listFiles(call.args.directoryPath);
                    break;
                default:
                    toolResult = "Unknown tool called.";
                    break;
            }
            
            result = await chat.sendMessage([
                { functionResponse: { name: call.name, response: { name: call.name, content: toolResult } } }
            ]);
        }

    } catch (error) {
        console.error('Error calling Gemini:', error);
        res.status(500).send({ error: 'Failed to communicate with AI' });
    }
});

app.get('/sessions', async (req, res) => {
    try {
        const sessions = await memory.listSessions();
        res.json(sessions);
    } catch (error) {
        console.error("Error listing sessions:", error);
        res.status(500).json({ error: "Failed to list sessions." });
    }
});

async function startServer() {
    await memory.initializeMemory();
    app.listen(PORT, () => console.log(`Server is listening on http://localhost:${PORT}`));
}

startServer();