// js/ai.js
console.log("HabitMentor AI Chat Initializing (Secured)...");

const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');

let currentUser = null;
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalTodayString() {
    return new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
}

// --- 1. SECURE AUTH GUARD ---
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || !session.user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    await loadTodayChatHistory();
});

// --- 2. LOAD HISTORY ---
async function loadTodayChatHistory() {
    try {
        const { data: history, error } = await supabaseClient
            .from('ai_chat_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('session_date', getLocalTodayString())
            .order('created_at', { ascending: true });

        if (error) throw error;
        
        if (history) {
            history.forEach(msg => appendBubble(msg.role, msg.message));
        }
    } catch (err) {
        console.error("Error loading chat history:", err);
    }
}

// --- 3. UI HELPERS ---
function appendBubble(role, text) {
    const bubble = document.createElement('div');
    // Ensure role is either 'user' or 'assistant'
    const safeRole = role === 'user' ? 'user' : 'assistant';
    bubble.className = `chat-bubble ${safeRole}`;
    bubble.textContent = text;
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function saveChatMessageToDB(role, text) {
    try {
        const { error } = await supabaseClient
            .from('ai_chat_history')
            .insert([{ 
                user_id: currentUser.id, 
                role: role, 
                message: text, 
                session_date: getLocalTodayString() 
            }]);
            
        if (error) throw error;
    } catch (err) {
        console.error("History save error:", err);
    }
}

// --- 4. SNEAKY AI BRAIN FUNCTION ---
// Grabs today's tasks so the AI knows what the user is supposed to do
async function getTodayTasksContext() {
    try {
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('title, is_completed')
            .eq('user_id', currentUser.id)
            .eq('scheduled_date', getLocalTodayString());

        if (error) throw error;
        
        if (!tasks || tasks.length === 0) {
            return "The user has no tasks scheduled for today.";
        }
        
        let context = "Here is the user's daily planner for today:\n";
        tasks.forEach(t => context += `- ${t.title} (Status: ${t.is_completed ? 'Done' : 'Not Done'})\n`);
        return context;
    } catch (e) {
        console.error("Context fetch error:", e);
        return "Could not load tasks.";
    }
}

// --- 5. CHAT SUBMISSION LOGIC ---
if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        if (!messageText || !currentUser) return;

        // Display user message instantly
        appendBubble('user', messageText);
        chatInput.value = '';
        sendMsgBtn.disabled = true;
        
        // Save user message to DB in background
        saveChatMessageToDB('user', messageText);

        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.textContent = "Your mentor is thinking...";
        chatBox.appendChild(typingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            let aiReplyText = "";
            const lowerMsg = messageText.toLowerCase();

            // FAST ACTION: Quick Add Task
            if (lowerMsg.startsWith('add:') || lowerMsg.startsWith('add ')) {
                const taskTitle = messageText.substring(4).trim();
                
                if (taskTitle) {
                    const { error } = await supabaseClient
                        .from('tasks')
                        .insert([{ 
                            user_id: currentUser.id, 
                            title: taskTitle, 
                            scheduled_date: getLocalTodayString(), 
                            xp_value: 10 
                        }]);

                    if (error) throw error;
                    aiReplyText = `Done! Added "${taskTitle}" to your planner timeline today.`;
                } else {
                    aiReplyText = "What should I add exactly? Try phrasing it like: 'add: 30 minutes of studying'.";
                }
            } 
            // NORMAL CHAT: Talk to AI Proxy
            else {
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
                
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                const data = await response.json();
                aiReplyText = data.reply;
            }

            // Remove typing indicator and show AI reply
            typingIndicator.remove();
            appendBubble('assistant', aiReplyText);
            saveChatMessageToDB('assistant', aiReplyText);

        } catch (err) {
            console.error("AI Thread error:", err);
            typingIndicator.remove();
            appendBubble('assistant', "Network glitch! Make sure you are connected, or try again in a moment.");
        } finally {
            sendMsgBtn.disabled = false;
        }
    });
}