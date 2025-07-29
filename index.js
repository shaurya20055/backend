require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const pdf = require('pdf-parse');
const memory = require('./memory.js');
const tools = require('./tools.js');

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "You are an expert AI assistant for software development. Your responses should be clear and well-structured. Always format code snippets using markdown, for example: ```javascript\nconsole.log('hello');\n```.",
    tools: tools.geminiTools
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    try {
        let textContent = '';
        if (req.file.mimetype === 'application/pdf') {
            const data = await pdf(req.file.buffer);
            textContent = data.text;
        } else if (req.file.mimetype.startsWith('text/')) {
            textContent = req.file.buffer.toString('utf-8');
        } else {
            return res.status(400).json({ error: `Unsupported file type: ${req.file.mimetype}` });
        }
        res.json({ text: textContent });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ error: 'Failed to process file.' });
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

app.post('/ask', async (req, res) => {
    const { prompt, sessionId: topicName } = req.body;
    if (!prompt) return res.status(400).send({ error: 'Prompt is required' });

    try {
        const canonicalSessionId = await memory.findOrCreateSession(topicName);
        const rawHistory = await memory.getHistory(canonicalSessionId);
        
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
                await memory.addMessage(canonicalSessionId, { role: 'user', content: prompt });
                await memory.addMessage(canonicalSessionId, { role: 'assistant', content: finalResponse });
                return res.send({ response: finalResponse });
            }

            const call = functionCalls[0];
            let toolResult;
            switch (call.name) {
                case 'webSearch':
                    toolResult = await tools.webSearch(call.args.query);
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

async function startServer() {
    await memory.initializeMemory();
    app.listen(PORT, () => console.log(`Server is listening on http://localhost:${PORT}`));
}

startServer();