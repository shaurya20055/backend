const axios = require('axios');

// This is the actual function that performs the web search
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
        // Return a simplified list of results
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

// This is the tool definition that we show to Gemini
const geminiTools = [
    {
        functionDeclarations: [
            {
                name: "webSearch",
                description: "Searches the web for up-to-date information on a given topic.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: {
                            type: "STRING",
                            description: "The search query."
                        }
                    },
                    required: ["query"]
                }
            }
        ]
    }
];

module.exports = {
    webSearch,
    geminiTools
};