document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const promptInput = document.getElementById('prompt-input');
    const fileInput = document.getElementById('file-input');
    const chatBox = document.getElementById('chat-box');
    const fileNameDisplay = document.getElementById('file-name-display');
    const sessionInput = document.getElementById('session-input');
    const sessionList = document.getElementById('session-list');
    const converter = new showdown.Converter({ noHeaderId: true, strikethrough: true, tables: true, tasklists: true, simpleLineBreaks: true });

    // --- SESSION MANAGEMENT ---
    async function loadSessions() {
        try {
            const response = await fetch('http://localhost:3000/sessions');
            const sessions = await response.json();
            const currentTopic = sessionInput.value; // Keep track of current topic
            sessionList.innerHTML = ''; 
            sessions.forEach(session => {
                const li = document.createElement('li');
                li.textContent = session;
                if (session === currentTopic) {
                    li.classList.add('active'); // Highlight the active session
                }
                li.addEventListener('click', () => {
                    sessionInput.value = session;
                    document.querySelectorAll('#session-list li').forEach(item => item.classList.remove('active'));
                    li.classList.add('active');
                    chatBox.innerHTML = `<div class="message ai-message">Switched to topic: ${session}</div>`;
                });
                sessionList.appendChild(li);
            });
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    }

    loadSessions();

    // --- FORM AND FILE LOGIC ---
    fileInput.addEventListener('change', () => {
        fileNameDisplay.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : '';
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textPrompt = promptInput.value.trim();
        const file = fileInput.files[0];
        const sessionId = sessionInput.value.trim();

        if ((!textPrompt && !file)) return;
        if (!sessionId) {
            alert("Please enter a topic name to start a conversation.");
            return;
        }

        if (textPrompt) addMessage(textPrompt, 'user-message', false);

        let fileContent = '';
        if (file) {
            // ... (file processing logic is unchanged)
        }

        const combinedPrompt = `${textPrompt}\n\n--- FILE CONTENT ---\n\n${fileContent}`;

        if (textPrompt || fileContent) {
            try {
                const response = await fetch('http://localhost:3000/ask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: combinedPrompt, sessionId: sessionId }),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Network response was not ok.');
                addMessage(data.response, 'ai-message', true);
                
                // --- THIS IS THE NEW LINE ---
                // Refresh the session list in case a new session was just created
                loadSessions(); 

            } catch (error) {
                console.error('Error:', error);
                addMessage(`Sorry, something went wrong: ${error.message}`, 'ai-message', false);
            }
        }

        promptInput.value = '';
        fileInput.value = '';
        fileNameDisplay.textContent = '';
    });

    function addMessage(text, className, isMarkdown) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', className);
        if (isMarkdown) {
            messageDiv.innerHTML = converter.makeHtml(text);
        } else {
            messageDiv.textContent = text;
        }
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});