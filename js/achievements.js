// js/achievements.js
console.log("HabitMentor Achievements Initializing...");

const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const badgeGrid = document.getElementById('badgeGrid');
const totalTasksText = document.getElementById('totalTasksText');
const unlockedCount = document.getElementById('unlockedCount');
const userInitialEl = document.getElementById('userInitial');

let currentUser = null;

// The Official Badge Dictionary & Unlock Rules
const BADGES = [
    { id: 'first_step', name: 'The First Step', icon: '🏆', desc: 'Complete your first task.', 
      check: (profile, tasks) => tasks >= 1 },
    { id: 'streak_3', name: 'Momentum', icon: '🔥', desc: 'Hit a 3-day streak.', 
      check: (profile, tasks) => profile.streak_current >= 3 },
    { id: 'level_5', name: 'Rising Star', icon: '⭐', desc: 'Reach Level 5.', 
      check: (profile, tasks) => profile.level >= 5 },
    { id: 'task_10', name: 'Consistency', icon: '📅', desc: 'Complete 10 total tasks.', 
      check: (profile, tasks) => tasks >= 10 },
    { id: 'streak_7', name: 'Unstoppable', icon: '⚡', desc: 'Hit a 7-day streak.', 
      check: (profile, tasks) => profile.streak_current >= 7 },
    { id: 'task_50', name: 'Executioner', icon: '⚔️', desc: 'Complete 50 total tasks.', 
      check: (profile, tasks) => tasks >= 50 }
];

// Auth Guard
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || !session.user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    await evaluateAchievements();
});

async function evaluateAchievements() {
    if (!badgeGrid || !currentUser) return;

    try {
        // 1. Fetch Profile Data (Level & Streak)
        const { data: profile, error: profileErr } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profileErr) throw profileErr;

        // Update Header Initial
        const username = profile.username || currentUser.email.split('@')[0];
        if (userInitialEl) {
            userInitialEl.textContent = username.charAt(0).toUpperCase();
        }

        // 2. Fetch Total Completed Tasks safely using the SDK count feature
        const { count: completedTasks, error: taskErr } = await supabaseClient
            .from('tasks')
            .select('*', { count: 'exact', head: true }) 
            .eq('user_id', currentUser.id)
            .eq('is_completed', true);

        if (taskErr) throw taskErr;

        if (totalTasksText) {
            totalTasksText.textContent = `${completedTasks || 0} Tasks Completed`;
        }

        // 3. Evaluate & Render Badges
        badgeGrid.innerHTML = '';
        let unlockedTotal = 0;

        BADGES.forEach(badge => {
            // Run the rule check for this specific badge safely
            let isUnlocked = false;
            try {
                isUnlocked = badge.check(profile, completedTasks || 0);
            } catch (e) {
                console.error(`Badge check failed for ${badge.id}:`, e);
            }
            
            if (isUnlocked) unlockedTotal++;

            // Create Card
            const card = document.createElement('div');
            card.className = `badge-card ${isUnlocked ? '' : 'locked'}`;
            card.innerHTML = `
                <div class="badge-icon">${badge.icon}</div>
                <h4>${badge.name}</h4>
                <p>${isUnlocked ? 'Unlocked!' : badge.desc}</p>
            `;
            badgeGrid.appendChild(card);
        });

        // Update the top fraction circle (e.g., "2/6")
        if (unlockedCount) {
            unlockedCount.textContent = `${unlockedTotal}/${BADGES.length}`;
        }
    } catch (err) {
        console.error("Error loading achievements:", err);
        badgeGrid.innerHTML = '<p class="error-message">Could not load trophies. Please check your connection.</p>';
    }
}