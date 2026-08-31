// js/dashboard.js
console.log("HabitMentor Dashboard Initializing (Secured)...");

const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// DOM Elements
const currentDateEl = document.getElementById('currentDate');
const prevDateBtn = document.getElementById('prevDateBtn');
const nextDateBtn = document.getElementById('nextDateBtn');
const greetingEl = document.getElementById('greeting');
const userInitialEl = document.getElementById('userInitial');
const userLevelEl = document.getElementById('userLevel');
const userStreakEl = document.getElementById('userStreak');
const taskModal = document.getElementById('taskModal');
const fabAdd = document.getElementById('fabAdd');
const closeModalBtn = document.getElementById('closeModalBtn');
const addTaskForm = document.getElementById('addTaskForm');
const taskTitleInput = document.getElementById('taskTitle');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const taskListEl = document.getElementById('taskList');
const taskProgressText = document.getElementById('taskProgressText');
const progressPercent = document.getElementById('progressPercent');
const friendsModal = document.getElementById('friendsModal');
const friendsBtn = document.getElementById('friendsBtn');
const closeFriendsBtn = document.getElementById('closeFriendsBtn');
const searchFriendBtn = document.getElementById('searchFriendBtn');
const friendSearchInput = document.getElementById('friendSearchInput');
const friendSearchResult = document.getElementById('friendSearchResult');
const leaderboardList = document.getElementById('leaderboardList');

let currentUser = null;
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let currentViewingDate = new Date();

// --- 1. TIME TRAVEL LOGIC ---
function getViewingDateString() {
    return currentViewingDate.toLocaleDateString('en-CA', { timeZone: userTimezone });
}

function updateDateDisplay() {
    const today = new Date();
    const todayString = today.toLocaleDateString('en-CA', { timeZone: userTimezone });
    const viewString = getViewingDateString();
    
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const formattedDate = currentViewingDate.toLocaleDateString('en-US', options);
    
    if (currentDateEl) {
        if (viewString === todayString) {
            currentDateEl.textContent = "Today, " + formattedDate;
        } else if (currentViewingDate < today && currentViewingDate.getDate() === today.getDate() - 1) {
            currentDateEl.textContent = "Yesterday, " + formattedDate;
        } else if (currentViewingDate > today && currentViewingDate.getDate() === today.getDate() + 1) {
            currentDateEl.textContent = "Tomorrow, " + formattedDate;
        } else {
            currentDateEl.textContent = formattedDate;
        }
    }
    if (currentUser) loadTasksForDate();
}

if (prevDateBtn) prevDateBtn.addEventListener('click', () => { 
    currentViewingDate.setDate(currentViewingDate.getDate() - 1); 
    updateDateDisplay(); 
});
if (nextDateBtn) nextDateBtn.addEventListener('click', () => { 
    currentViewingDate.setDate(currentViewingDate.getDate() + 1); 
    updateDateDisplay(); 
});

// --- 2. SECURE AUTH GUARD ---
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || !session.user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    updateDateDisplay();
    await loadUserProfile();
});

// --- 3. PROFILES & TASKS (USING SUPABASE SDK) ---
async function loadUserProfile() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;
        if (!data) return;

        const username = data.username || currentUser.email.split('@')[0];
        if(greetingEl) greetingEl.textContent = `Good day, ${username}!`;
        if(userInitialEl) userInitialEl.textContent = username.charAt(0).toUpperCase();
        if(userLevelEl) userLevelEl.textContent = data.level;
        if(userStreakEl) userStreakEl.textContent = data.streak_current;
    } catch (err) {
        console.error("Profile load error:", err);
    }
}

async function loadTasksForDate() {
    try {
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('scheduled_date', getViewingDateString())
            .order('created_at', { ascending: true });

        if (error) throw error;
        renderTasks(tasks);
    } catch (err) {
        console.error("Task load error:", err);
    }
}

function renderTasks(tasks) {
    if(!taskListEl) return;
    taskListEl.innerHTML = ''; 

    if (!tasks || tasks.length === 0) {
        taskListEl.innerHTML = '<p class="empty-state">No tasks scheduled for this day. Add one below!</p>';
        if(taskProgressText) taskProgressText.textContent = "0 of 0 Completed";
        if(progressPercent) progressPercent.textContent = "0%";
        return;
    }

    let completedCount = 0;
    tasks.forEach(task => {
        if (task.is_completed) completedCount++;
        
        const card = document.createElement('div');
        card.className = `task-card ${task.is_completed ? 'completed' : ''}`;
        card.innerHTML = `<div class="task-checkbox">${task.is_completed ? '✓' : ''}</div><span class="task-title">${task.title}</span>`;
        
        if (!task.is_completed) {
            card.onclick = () => markTaskComplete(task.id, card);
            card.style.cursor = 'pointer';
        }
        taskListEl.appendChild(card);
    });

    if(taskProgressText) taskProgressText.textContent = `${completedCount} of ${tasks.length} Completed`;
    if(progressPercent) progressPercent.textContent = `${Math.round((completedCount / tasks.length) * 100)}%`;
}

// --- 4. TASK CREATION & COMPLETION ---
if(fabAdd) fabAdd.addEventListener('click', () => taskModal.classList.remove('hidden'));
if(closeModalBtn) closeModalBtn.addEventListener('click', () => taskModal.classList.add('hidden'));

if(addTaskForm) {
    addTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = taskTitleInput.value.trim();
        if (!title) return;
        
        saveTaskBtn.disabled = true;
        saveTaskBtn.textContent = "Saving...";
        
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .insert([{ 
                    user_id: currentUser.id, 
                    title: title, 
                    scheduled_date: getViewingDateString(), 
                    xp_value: 10 
                }]);

            if (error) throw error;
            
            taskModal.classList.add('hidden');
            addTaskForm.reset();
            await loadTasksForDate();
        } catch (err) {
            console.error(err);
            alert(`Error: ${err.message}`);
        } finally {
            saveTaskBtn.disabled = false;
            saveTaskBtn.textContent = "Save Task";
        }
    });
}

async function markTaskComplete(taskId, cardElement) {
    cardElement.style.pointerEvents = 'none';
    cardElement.style.opacity = '0.5';
    try {
        const { error } = await supabaseClient.rpc('complete_task_and_award_xp', { 
            p_task_id: taskId, 
            p_user_id: currentUser.id 
        });

        if (error) throw error;
        
        await loadUserProfile();
        await loadTasksForDate();
    } catch (err) {
        console.error("Failed to mark complete:", err);
        cardElement.style.pointerEvents = 'auto';
        cardElement.style.opacity = '1';
    }
}

// --- 5. LEADERBOARD ---
if(friendsBtn) friendsBtn.addEventListener('click', () => { 
    friendsModal.classList.remove('hidden'); 
    loadLeaderboard(); 
});
if(closeFriendsBtn) closeFriendsBtn.addEventListener('click', () => { 
    friendsModal.classList.add('hidden'); 
    friendSearchInput.value = ''; 
    friendSearchResult.innerHTML = ''; 
});

if(searchFriendBtn) {
    searchFriendBtn.addEventListener('click', async () => {
        const query = friendSearchInput.value.trim();
        if (!query) return;
        
        searchFriendBtn.textContent = '...';
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id, username')
                .eq('username', query);

            if (error || !data || data.length === 0) throw new Error('User not found');
            
            const friend = data[0];
            if (friend.id === currentUser.id) throw new Error('Cannot add yourself');
            
            friendSearchResult.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                <strong>${friend.username}</strong><button onclick="sendFriendRequest('${friend.id}')" class="btn-primary" style="margin: 0; padding: 6px 14px; font-size: 12px; width: auto;">Add</button></div>`;
        } catch (err) {
            friendSearchResult.innerHTML = `<p class="error-message">User not found or invalid.</p>`;
        } finally {
            searchFriendBtn.textContent = 'Search';
        }
    });
}

window.sendFriendRequest = async (receiverId) => {
    try {
        const { error } = await supabaseClient
            .from('friendships')
            .insert([{ requester_id: currentUser.id, receiver_id: receiverId }]);

        if (error) throw error;
        
        friendSearchResult.innerHTML = `<p style="color: var(--primary-color); font-weight: bold;">Added to leaderboard!</p>`;
        await loadLeaderboard();
    } catch (err) {
        friendSearchResult.innerHTML = `<p class="error-message">Already on your leaderboard!</p>`;
    }
};

async function loadLeaderboard() {
    if(!leaderboardList) return;
    try {
        const { data: friends, error: fError } = await supabaseClient
            .from('friendships')
            .select('receiver_id')
            .eq('requester_id', currentUser.id);

        if (fError) throw fError;

        const friendIds = friends ? friends.map(f => f.receiver_id) : [];
        friendIds.push(currentUser.id);

        const { data: profiles, error: pError } = await supabaseClient
            .from('profiles')
            .select('username, level, streak_current, id')
            .in('id', friendIds)
            .order('streak_current', { ascending: false });

        if (pError) throw pError;

        leaderboardList.innerHTML = '';
        profiles.forEach((p, index) => {
            const isMe = p.id === currentUser.id;
            const card = document.createElement('div');
            card.className = 'task-card';
            card.style.cursor = 'default';
            if (isMe) card.style.borderLeft = '4px solid var(--primary-color)';
            
            card.innerHTML = `<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                <span style="font-weight: bold;">#${index + 1} <span style="font-weight: normal; margin-left: 8px;">${p.username} ${isMe ? '(You)' : ''}</span></span>
                <span style="font-size: 14px;">🔥 ${p.streak_current} <span style="margin: 0 4px; color: var(--text-secondary);">|</span> Lvl ${p.level}</span></div>`;
            leaderboardList.appendChild(card);
        });
    } catch (err) {
        console.error("Leaderboard load error:", err);
    }
}