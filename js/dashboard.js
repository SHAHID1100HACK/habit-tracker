// js/dashboard.js
console.log("HabitMentor Dashboard Initializing with ABSOLUTE Native Override...");

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

// --- 1. TIME TRAVEL LOGIC (MOVED TO TOP TO FIX CRASH) ---
let currentViewingDate = new Date();

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

if (prevDateBtn) prevDateBtn.addEventListener('click', () => { currentViewingDate.setDate(currentViewingDate.getDate() - 1); updateDateDisplay(); });
if (nextDateBtn) nextDateBtn.addEventListener('click', () => { currentViewingDate.setDate(currentViewingDate.getDate() + 1); updateDateDisplay(); });


// --- 2. THE AUTHENTICATION HEIST ---
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

// --- 3. AUTH GUARD ---
const currentSession = getManualSession();
if (!currentSession || !currentSession.user) {
    console.error("No user found in Local Storage. Redirecting to login...");
    window.location.href = '../index.html';
} else {
    currentUser = currentSession.user;
    updateDateDisplay(); // Now this works perfectly because the variables exist!
    loadUserProfile();
}

// --- 4. NATIVE FETCH DATA LOADING ---
async function loadUserProfile() {
    try {
        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?id=eq.${currentUser.id}&select=*`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json())[0];
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
        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/tasks?select=*&user_id=eq.${currentUser.id}&scheduled_date=eq.${getViewingDateString()}&order=created_at.asc`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(await res.text());
        renderTasks(await res.json());
    } catch (err) {
        console.error("Task load error:", err);
    }
}

// --- 5. MODALS & TASK ADDITION (NATIVE) ---
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
            const requestPromise = fetch(`${CONFIG.SUPABASE_URL}/rest/v1/tasks`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ user_id: currentUser.id, title: title, scheduled_date: getViewingDateString(), xp_value: 10 })
            });

            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Network timed out.")), 5000));
            const res = await Promise.race([requestPromise, timeoutPromise]);
            
            if (!res.ok) throw new Error(`DB Error: ${await res.text()}`);

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

async function markTaskComplete(taskId, cardElement) {
    cardElement.style.pointerEvents = 'none';
    cardElement.style.opacity = '0.5';
    try {
        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/complete_task_and_award_xp`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ p_task_id: taskId, p_user_id: currentUser.id })
        });
        if (!res.ok) throw new Error(await res.text());
        await loadUserProfile();
        await loadTasksForDate();
    } catch (err) {
        console.error("Failed to mark complete:", err);
        cardElement.style.pointerEvents = 'auto';
        cardElement.style.opacity = '1';
    }
}

// --- 6. LEADERBOARD (NATIVE) ---
if(friendsBtn) friendsBtn.addEventListener('click', () => { friendsModal.classList.remove('hidden'); loadLeaderboard(); });
if(closeFriendsBtn) closeFriendsBtn.addEventListener('click', () => { friendsModal.classList.add('hidden'); friendSearchInput.value = ''; friendSearchResult.innerHTML = ''; });

if(searchFriendBtn) {
    searchFriendBtn.addEventListener('click', async () => {
        const query = friendSearchInput.value.trim();
        if (!query) return;
        searchFriendBtn.textContent = '...';
        try {
            const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?username=eq.${query}&select=id,username`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (!data || data.length === 0) throw new Error('User not found');
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
        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/friendships`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ requester_id: currentUser.id, receiver_id: receiverId })
        });
        if (!res.ok) throw new Error("Failed to add friend");
        friendSearchResult.innerHTML = `<p style="color: var(--primary-color); font-weight: bold;">Added to leaderboard!</p>`;
        await loadLeaderboard();
    } catch (err) {
        friendSearchResult.innerHTML = `<p class="error-message">Already on your leaderboard!</p>`;
    }
};

async function loadLeaderboard() {
    if(!leaderboardList) return;
    try {
        const fRes = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/friendships?requester_id=eq.${currentUser.id}&select=receiver_id`, { headers: getAuthHeaders() });
        const friends = await fRes.json();
        const friendIds = friends ? friends.map(f => f.receiver_id) : [];
        friendIds.push(currentUser.id);

        const idString = friendIds.map(id => `"${id}"`).join(',');
        const pRes = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?id=in.(${idString})&select=username,level,streak_current,id&order=streak_current.desc`, { headers: getAuthHeaders() });
        const profiles = await pRes.json();

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