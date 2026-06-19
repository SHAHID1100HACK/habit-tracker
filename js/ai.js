// js/ai.js
console.log("HabitMentor AI Chat Initializing with Task Awareness...");

const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');

let currentUser = null;
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalTodayString() {
    return new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
}

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

const currentSession = getManualSession();
if (!currentSession || !currentSession.user) {
    window.location.href = '../index.html';
} else {
    currentUser = currentSession.user;
    loadTodayChatHistory();
}

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
    fetch(`${CONFIG.SUPABASE_URL}/rest/v1/ai_chat_history`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: currentUser.id, role: role, message: text, session_date: getLocalTodayString() })
    }).catch(err => console.error("History save error:", err));
}

function appendBubble(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role === 'user' ? 'user' : 'assistant'}`;
    bubble.textContent = text; 
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- NEW SNEAKY AI BRAIN FUNCTION ---
async function getTodayTasksContext() {
    try {
        const url = `${CONFIG.SUPABASE_URL}/rest/v1/tasks?select=title,is_completed&user_id=eq.${currentUser.id}&scheduled_date=eq.${getLocalTodayString()}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const tasks = await res.json();
        if (!tasks || tasks.length === 0) return "The user has no tasks scheduled for today.";
        
        let context = "Here is the user's daily planner for today:\n";
        tasks.forEach(t => context += `- ${t.title} (Status: ${t.is_completed ? 'Done' : 'Not Done'})\n`);
        return context;
    } catch (e) {
        return "Could not load tasks.";
    }
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    appendBubble('user', messageText);
    chatInput.value = '';
    sendMsgBtn.disabled = true;
    
    saveChatMessageToDB('user', messageText);

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.textContent = "Your mentor is thinking... ⚡";
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        let aiReplyText = "";
        const lowerMsg = messageText.toLowerCase();

        if (lowerMsg.startsWith('add:') || lowerMsg.startsWith('add ')) {
            
            const taskTitle = messageText.substring(4).trim();
            
            if (taskTitle) {
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
            // NORMAL CHAT: Grab tasks and inject them secretly!
            const taskContext = await getTodayTasksContext();
            
            const response = await fetch(`${CONFIG.PROXY_URL}/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'mentor',
                    messages: [
                        { role: 'system', content: `Context for this conversation: ${taskContext}` },
                        { role: 'user', content: messageText }
                    ]
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            aiReplyText = data.reply;
        }

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