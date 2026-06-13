// js/ai.js
console.log("HabitMentor AI Chat Initializing with Local Interceptor...");

const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');

let currentUser = null;
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalTodayString() {
    return new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
}

// --- 1. THE AUTHENTICATION HEIST ---
function getManualSession() {
    try {
        const projectRef = CONFIG.SUPABASE_URL.split('//')[1].split('.')[0];
        const sessionStr = localStorage.getItem(`sb-${projectRef}-auth-token`);
        return sessionStr ? JSON.parse(sessionStr) : null;
    } catch (e) {
        return null;
    }
}

function getAuthHeaders() {
    const session = getManualSession();
    if (!session || !session.access_token) throw new Error("No valid session found.");
    return {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

// --- 2. AUTH GUARD ---
const currentSession = getManualSession();
if (!currentSession || !currentSession.user) {
    window.location.href = '../index.html';
} else {
    currentUser = currentSession.user;
    loadTodayChatHistory();
}

// --- 3. DATABASE HELPERS (NATIVE FETCH) ---
async function loadTodayChatHistory() {
    try {
        const url = `${CONFIG.SUPABASE_URL}/rest/v1/ai_chat_history?user_id=eq.${currentUser.id}&session_date=eq.${getLocalTodayString()}&order=created_at.asc`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(await res.text());
        
        const history = await res.json();
        if (history) history.forEach(msg => appendBubble(msg.role, msg.message));
    } catch (err) {
        console.error("Error loading chat history:", err);
    }
}

function saveChatMessageToDB(role, text) {
    // Fire and forget
    fetch(`${CONFIG.SUPABASE_URL}/rest/v1/ai_chat_history`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: currentUser.id, role: role, message: text, session_date: getLocalTodayString() })
    }).catch(err => console.error("History save error:", err));
}

// --- 4. RENDER BUBBLES ---
function appendBubble(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role === 'user' ? 'user' : 'assistant'}`;
    bubble.textContent = text; 
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- 5. MAIN EVENT LOOP (WITH LOCAL INTERCEPTOR) ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    // UI Updates
    appendBubble('user', messageText);
    chatInput.value = '';
    sendMsgBtn.disabled = true;
    
    // Save user message immediately
    saveChatMessageToDB('user', messageText);

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.textContent = "Your mentor is thinking... ⚡";
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        let aiReplyText = "";
        const lowerMsg = messageText.toLowerCase();

        // 💥 THE LOCAL INTERCEPTOR: Bypass AI for Task Additions
        if (lowerMsg.startsWith('add:') || lowerMsg.startsWith('add ')) {
            
            // Extract the task name (removes the "add:" or "add " part)
            const taskTitle = messageText.substring(4).trim();
            
            if (taskTitle) {
                // Native Fetch Insert to Dashboard Tasks
                const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/tasks`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ user_id: currentUser.id, title: taskTitle, scheduled_date: getLocalTodayString(), xp_value: 10 })
                });

                if (!res.ok) throw new Error(`Task DB Error: ${await res.text()}`);
                
                aiReplyText = `Done! Added "${taskTitle}" to your planner timeline today. 📌`;
            } else {
                aiReplyText = "What should I add exactly? Try phrasing it like: 'add: 30 minutes of studying'.";
            }

        } else {
            // NORMAL CHAT: Route to Cloudflare Worker
            const response = await fetch(`${CONFIG.PROXY_URL}/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'mentor',
                    messages: [{ role: 'user', content: messageText }]
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            aiReplyText = data.reply;
        }

        // Render Answer & Save to DB
        typingIndicator.remove();
        appendBubble('assistant', aiReplyText);
        saveChatMessageToDB('assistant', aiReplyText);

    } catch (err) {
        console.error("AI Thread error:", err);
        typingIndicator.remove();
        appendBubble('assistant', "Network glitch! Make sure you are connected, or try again in a moment. 🤔");
    } finally {
        sendMsgBtn.disabled = false;
    }
});