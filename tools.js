const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { runCommand } = require('./commandExecutor.js'); // Required for Git tools

// --- TOOL FUNCTIONS ---

// Web Search Tool
async function webSearch(query) {
    try {
        const response = await axios.post('https://google.serper.dev/search', {
            q: query
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        // Return a simplified list of the top 5 results
        return JSON.stringify(response.data.organic.slice(0, 5).map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet
        })));
    } catch (error) {
        console.error('Error during web search:', error);
        return 'Failed to perform web search.';
    }
}

// Read File Tool
async function readFile(filePath) {
    try {
        const fullPath = path.resolve(filePath);
        return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
        return `Error reading file: ${error.message}`;
    }
}

// Write File Tool
async function writeFile(filePath, content) {
    try {
        const fullPath = path.resolve(filePath);
        await fs.writeFile(fullPath, content);
        return `Successfully wrote to ${filePath}`;
    } catch (error) {
        return `Error writing to file: ${error.message}`;
    }
}

// List Files Tool
async function listFiles(directoryPath = '.') {
    try {
        const fullPath = path.resolve(directoryPath);
        const files = await fs.readdir(fullPath);
        return JSON.stringify(files);
    } catch (error) {
        return `Error listing files: ${error.message}`;
    }
}

// Git Tool Functions
async function gitStatus() {
    return await runCommand('git status');
}

async function gitDiff() {
    return await runCommand('git diff');
}

async function gitAdd(files = '.') {
    return await runCommand(`git add ${files}`);
}

async function gitCommit(message) {
    const sanitizedMessage = message.replace(/"/g, '\\"');
    return await runCommand(`git commit -m "${sanitizedMessage}"`);
}


// --- TOOL DEFINITIONS FOR GEMINI ---

const geminiTools = [{
    functionDeclarations: [{
        name: "webSearch",
        description: "Searches the web for up-to-date information on a given topic.",
        parameters: {
            type: "OBJECT",
            properties: { query: { type: "STRING", description: "The search query." } },
            required: ["query"]
        }
    }, {
        name: "readFile",
        description: "Reads the content of a specified file.",
        parameters: {
            type: "OBJECT",
            properties: { filePath: { type: "STRING", description: "The path to the file." } },
            required: ["filePath"]
        }
    }, {
        name: "writeFile",
        description: "Writes content to a specified file, overwriting it if it exists.",
        parameters: {
            type: "OBJECT",
            properties: {
                filePath: { type: "STRING", description: "The path to the file." },
                content: { type: "STRING", description: "The content to write." }
            },
            required: ["filePath", "content"]
        }
    }, {
        name: "listFiles",
        description: "Lists all files and directories in a specified directory.",
        parameters: {
            type: "OBJECT",
            properties: { directoryPath: { type: "STRING", description: "The path to the directory. Defaults to the current directory." } },
            required: []
        }
    }, {
        name: "gitStatus",
        description: "Checks the current status of the git repository."
    }, {
        name: "gitDiff",
        description: "Shows the differences between the working directory and the git index."
    }, {
        name: "gitAdd",
        description: "Stages changes in the repository. Defaults to staging all files.",
        parameters: {
            type: "OBJECT",
            properties: { files: { type: "STRING", description: "The files to add. Defaults to '.' (all files)." } },
            required: []
        }
    }, {
        name: "gitCommit",
        description: "Commits the staged changes with a given message.",
        parameters: {
            type: "OBJECT",
            properties: { message: { type: "STRING", description: "The commit message." } },
            required: ["message"]
        }
    }]
}];

module.exports = {
    webSearch,
    readFile,
    writeFile,
    listFiles,
    gitStatus,
    gitDiff,
    gitAdd,
    gitCommit,
    geminiTools
};