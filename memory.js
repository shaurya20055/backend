const { ChromaClient } = require('chromadb');

const client = new ChromaClient();
const HISTORY_COLLECTION_NAME = "chat_history";
const SESSIONS_COLLECTION_NAME = "sessions";
let historyCollection;
let sessionsCollection;

async function initializeMemory() {
    try {
        historyCollection = await client.getOrCreateCollection({ name: HISTORY_COLLECTION_NAME });
        sessionsCollection = await client.getOrCreateCollection({ name: SESSIONS_COLLECTION_NAME });
        console.log("ChromaDB collections loaded successfully.");

        // --- NEW: One-Time Migration Logic ---
        console.log("Checking for past conversations to index...");
        const allHistory = await historyCollection.get();
        const existingSessions = await sessionsCollection.get();
        const existingSessionIds = new Set(existingSessions.ids);

        const foundSessionIds = new Set();
        if (allHistory.ids.length > 0) {
            allHistory.metadatas.forEach(meta => {
                // If a session ID exists and isn't already indexed, add it.
                if (meta && meta.sessionId) {
                    foundSessionIds.add(meta.sessionId);
                } else {
                    // For old messages without a session ID, group them into a default topic.
                    foundSessionIds.add("(Uncategorized Conversation)");
                }
            });
        }

        const newSessionsToAdd = [...foundSessionIds].filter(id => !existingSessionIds.has(id));

        if (newSessionsToAdd.length > 0) {
            console.log(`Found ${newSessionsToAdd.length} new topics to index...`);
            await sessionsCollection.add({
                ids: newSessionsToAdd,
                documents: newSessionsToAdd,
            });
            console.log("Successfully indexed past conversations.");
        } else {
            console.log("No new past conversations to index.");
        }
        // --- End of Migration Logic ---

    } catch (error) {
        console.error("Error initializing ChromaDB:", error);
        process.exit(1);
    }
}

async function findOrCreateSession(topicName, similarityThreshold = 0.9) {
    if (!sessionsCollection) throw new Error("Session memory not initialized.");
    if (!topicName) return "(Uncategorized Conversation)"; // Default to this if topic is empty

    const results = await sessionsCollection.query({
        queryTexts: [topicName],
        nResults: 1,
    });

    if (results.ids[0].length > 0 && results.distances[0][0] < (1 - similarityThreshold)) {
        return results.ids[0][0];
    } else {
        await sessionsCollection.add({
            ids: [topicName],
            documents: [topicName],
        });
        return topicName;
    }
}

async function addMessage(sessionId, message) {
    if (!historyCollection) throw new Error("History memory not initialized.");
    let effectiveSessionId = sessionId || "(Uncategorized Conversation)";

    const id = new Date().toISOString();
    await historyCollection.add({
        ids: [id],
        documents: [message.content],
        metadatas: [{ role: message.role, sessionId: effectiveSessionId }],
    });
}

async function getHistory(sessionId, limit = 20) {
    if (!historyCollection) throw new Error("History memory not initialized.");
    let effectiveSessionId = sessionId || "(Uncategorized Conversation)";

    const results = await historyCollection.get({
        where: { "sessionId": effectiveSessionId },
        limit: limit,
    });

    if (!results.ids || results.ids.length === 0) return [];

    return results.ids
        .map((id, index) => ({
            id: id,
            role: results.metadatas[index].role,
            content: results.documents[index],
        }))
        .sort((a, b) => new Date(a.id) - new Date(b.id));
}

async function listSessions() {
    if (!sessionsCollection) throw new Error("Session memory not initialized.");
    const results = await sessionsCollection.get();
    return results.ids.sort();
}

module.exports = {
    initializeMemory,
    findOrCreateSession,
    addMessage,
    getHistory,
    listSessions
};