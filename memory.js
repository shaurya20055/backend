const { ChromaClient } = require('chromadb');

// Initialize the ChromaDB client. It runs in-memory by default.
const client = new ChromaClient();
const COLLECTION_NAME = "chat_history";
let collection;

// Asynchronously initialize the collection
async function initializeMemory() {
    try {
        collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });
        console.log("ChromaDB collection loaded successfully.");
    } catch (error) {
        console.error("Error initializing ChromaDB:", error);
        process.exit(1); // Exit if we can't connect to memory
    }
}

// Add a message to the persistent memory
async function addMessage(message) {
    if (!collection) throw new Error("Memory not initialized.");

    // We use a timestamp as the ID to keep messages in order
    const id = new Date().toISOString();
    
    await collection.add({
        ids: [id],
        documents: [message.content],
        metadatas: [{ role: message.role }],
    });
}

// Get the last 'n' messages from memory
async function getHistory(limit = 10) {
    if (!collection) throw new Error("Memory not initialized.");

    const results = await collection.get({
        limit: limit,
        // We don't need to sort here because we'll sort the results by ID (timestamp)
    });

    // The results need to be sorted chronologically and formatted correctly
    const history = results.ids
        .map((id, index) => ({
            id: id,
            role: results.metadatas[index].role,
            content: results.documents[index],
        }))
        .sort((a, b) => new Date(a.id) - new Date(b.id)); // Sort by timestamp

    return history;
}

module.exports = {
    initializeMemory,
    addMessage,
    getHistory,
};