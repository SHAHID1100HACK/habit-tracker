// js/goals.js
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const goalForm = document.getElementById('goalForm');
const goalInput = document.getElementById('goalInput');
// Match the IDs exactly as they appear in your HTML
const saveGoalBtn = document.getElementById('saveGoalBtn'); 
const goalList = document.getElementById('goalList');

let currentUser = null;
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getLocalTodayString() {
    return new Date().toLocaleDateString('en-CA', { timeZone: userTimezone });
}

// 1. Auth Guard & Initial Load
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || !session.user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    await loadExistingGoals();
});

// 2. Fetch and Render Saved Goals
async function loadExistingGoals() {
    if (!goalList || !currentUser) return;

    try {
        const { data: goals, error } = await supabaseClient
            .from('goals')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        goalList.innerHTML = '';

        if (!goals || goals.length === 0) {
            goalList.innerHTML = '<p class="empty-state">No big targets set yet. Define your vision above!</p>';
            return;
        }

        goals.forEach((goal) => {
            const card = document.createElement('div');
            card.className = 'task-card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.gap = '8px';

            let roadmapStepsHtml = '';
            if (goal.roadmap && Array.isArray(goal.roadmap.tasks)) {
                roadmapStepsHtml = `
                    <div style="margin-top: 8px; width: 100%; border-top: 1px solid var(--border-color); padding-top: 8px;">
                        <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">Generated Roadmap Steps:</span>
                        <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 13px;">
                            ${goal.roadmap.tasks.map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <span class="task-title" style="font-weight: 600;">${goal.title}</span>
                    <span style="font-size: 11px; background: var(--surface-color); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 6px;">
                        ${new Date(goal.created_at).toLocaleDateString()}
                    </span>
                </div>
                ${roadmapStepsHtml}
            `;
            goalList.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading goals:", err);
    }
}

// 3. Generate Roadmap & Save
if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalText = goalInput.value.trim();
        if (!goalText || !currentUser) return;

        saveGoalBtn.disabled = true;
        saveGoalBtn.textContent = "Analyzing & Building Plan...";

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

            // 2. Robust JSON parsing (prevents crashes from bad AI formatting)
            let rawReply = (data.reply || '').replace(/```json/gi, '').replace(/```/g, '').trim();
            const firstBracket = rawReply.indexOf('{');
            const lastBracket = rawReply.lastIndexOf('}');
            
            let parsedRoadmap = { tasks: [] };

            if (firstBracket !== -1 && lastBracket !== -1) {
                try {
                    const cleanJsonString = rawReply.substring(firstBracket, lastBracket + 1);
                    parsedRoadmap = JSON.parse(cleanJsonString);
                } catch (parseErr) {
                    console.warn("Could not parse AI output as JSON, saving raw goal.", parseErr);
                }
            }

            // 3. Insert Goal into DB
            const { data: insertedGoal, error: goalError } = await supabaseClient
                .from('goals')
                .insert([{
                    user_id: currentUser.id,
                    title: goalText,
                    category: 'learning',
                    roadmap: parsedRoadmap
                }])
                .select()
                .single();

            if (goalError) throw goalError;

            // 4. Insert Roadmap Steps as Daily Tasks
            if (parsedRoadmap.tasks && Array.isArray(parsedRoadmap.tasks) && parsedRoadmap.tasks.length > 0) {
                const tasksToInsert = parsedRoadmap.tasks.map(taskTitle => ({
                    user_id: currentUser.id,
                    goal_id: insertedGoal.id, // Link task to the new goal
                    title: taskTitle,
                    scheduled_date: getLocalTodayString(),
                    xp_value: 20 // Roadmap tasks give double XP!
                }));

                const { error: tasksError } = await supabaseClient.from('tasks').insert(tasksToInsert);
                if (tasksError) console.error("Error inserting generated tasks:", tasksError);
            }

            goalInput.value = '';
            await loadExistingGoals(); // Refresh the list
            alert("Goal locked in! Actionable tasks have been added to your timeline.");

        } catch (err) {
            console.error("Roadmap generation failed:", err);
            alert("The AI had trouble parsing that goal. Try making it a bit more specific!");
        } finally {
            saveGoalBtn.disabled = false;
            saveGoalBtn.textContent = "Lock in Goal";
        }
    });
}