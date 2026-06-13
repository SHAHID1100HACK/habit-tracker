// js/goals.js
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const goalForm = document.getElementById('goalForm');
const goalInput = document.getElementById('goalInput');
const generateBtn = document.getElementById('generateBtn');
const roadmapArea = document.getElementById('roadmapArea');
const roadmapList = document.getElementById('roadmapList');

let currentUser = null;
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalTodayString() {
    return new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
}

// Auth Guard
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (!session) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
});

// Generate Roadmap
goalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalText = goalInput.value.trim();
    if (!goalText) return;

    generateBtn.disabled = true;
    generateBtn.textContent = "Analyzing Goal & Building Plan... 🧠";
    roadmapArea.classList.add('hidden');
    roadmapList.innerHTML = '';

    try {
        // 1. Ask AI to break it down
        const response = await fetch(`${CONFIG.PROXY_URL}/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'roadmap',
                messages: [{ role: 'user', content: goalText }]
            })
        });

        if (!response.ok) throw new Error("AI Request Failed");
        const data = await response.json();

        // 2. Parse the Llama 3.1 JSON output securely
        let cleanJsonString = data.reply.substring(data.reply.indexOf('{'), data.reply.lastIndexOf('}') + 1);
        const parsedData = JSON.parse(cleanJsonString);

        if (!parsedData.tasks || !Array.isArray(parsedData.tasks)) throw new Error("Invalid format");

        // 3. Prepare data for Supabase Bulk Insert
        const tasksToInsert = parsedData.tasks.map(taskTitle => ({
            user_id: currentUser.id,
            title: taskTitle,
            scheduled_date: getLocalTodayString(),
            xp_value: 20 // Roadmap tasks give double XP!
        }));

        // 4. Insert directly to the user's timeline
        const { error } = await supabaseClient.from('tasks').insert(tasksToInsert);
        if (error) throw error;

        // 5. Display the newly generated roadmap
        parsedData.tasks.forEach((task, index) => {
            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `<span style="font-weight: bold; margin-right: 12px; color: var(--primary-color);">Step ${index + 1}</span> <span>${task}</span>`;
            roadmapList.appendChild(card);
        });

        roadmapArea.classList.remove('hidden');
        goalInput.value = '';

    } catch (err) {
        console.error("Roadmap generation failed:", err);
        alert("The AI had trouble parsing that goal. Try making it a bit more specific!");
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Another Roadmap ⚡";
    }
});