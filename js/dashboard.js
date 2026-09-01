const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const datePicker = document.getElementById('datePicker');
const greetingEl = document.getElementById('greeting');
const taskModal = document.getElementById('taskModal');
const taskListEl = document.getElementById('taskList');
const taskProgressText = document.getElementById('taskProgressText');
const progressPercent = document.getElementById('progressPercent');
const friendSearchInput = document.getElementById('friendSearchInput');
const friendSearchResult = document.getElementById('friendSearchResult');
const leaderboardList = document.getElementById('leaderboardList');
const searchFriendBtn = document.getElementById('searchFriendBtn');
const friendsBtn = document.getElementById('friendsBtn');
const friendsModal = document.getElementById('friendsModal');

let currentUser = null;

// Initialize Date Picker to Today
const today = new Date();
const offset = today.getTimezoneOffset() * 60000;
const localISOTime = (new Date(today - offset)).toISOString().split('T')[0];
if(datePicker) datePicker.value = localISOTime;

if(datePicker) {
    datePicker.addEventListener('change', () => {
        if(currentUser) loadTasksForDate();
    });
}

function getViewingDateString() {
    return datePicker.value;
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || !session.user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    await loadUserProfile();
    await loadTasksForDate();
});

async function loadUserProfile() {
    try {
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
        if (error) throw error;
        if (greetingEl) greetingEl.textContent = `Good day, ${data.username}!`;
    } catch (err) { console.error(err); }
}

async function loadTasksForDate() {
    try {
        const { data: tasks, error } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).eq('scheduled_date', getViewingDateString()).order('created_at', { ascending: true });
        if (error) throw error;
        renderTasks(tasks);
    } catch (err) { console.error(err); }
}

function renderTasks(tasks) {
    if(!taskListEl) return;
    taskListEl.innerHTML = ''; 

    if (!tasks || tasks.length === 0) {
        taskListEl.innerHTML = '<p class="empty-state">No tasks scheduled for this day.</p>';
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
        
        // ALLOW UNCHECKING NOW
        card.onclick = () => toggleTaskComplete(task.id, task.is_completed, card);
        card.style.cursor = 'pointer';
        
        taskListEl.appendChild(card);
    });

    if(taskProgressText) taskProgressText.textContent = `${completedCount} of ${tasks.length} Completed`;
    if(progressPercent) progressPercent.textContent = `${Math.round((completedCount / tasks.length) * 100)}%`;
}

// THE UNCHECK FIX
async function toggleTaskComplete(taskId, currentlyCompleted, cardElement) {
    cardElement.style.pointerEvents = 'none';
    cardElement.style.opacity = '0.5';
    try {
        if (currentlyCompleted) {
            // Uncheck it directly
            const { error } = await supabaseClient.from('tasks').update({ is_completed: false }).eq('id', taskId);
            if (error) throw error;
        } else {
            // Check it & award XP
            const { error } = await supabaseClient.rpc('complete_task_and_award_xp', { p_task_id: taskId, p_user_id: currentUser.id });
            if (error) throw error;
        }
        await loadUserProfile();
        await loadTasksForDate();
    } catch (err) {
        console.error("Failed to toggle:", err);
        cardElement.style.pointerEvents = 'auto';
        cardElement.style.opacity = '1';
    }
}

// Add task functionality
document.getElementById('fabAdd')?.addEventListener('click', () => taskModal.classList.remove('hidden'));
document.getElementById('closeModalBtn')?.addEventListener('click', () => taskModal.classList.add('hidden'));
document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;
    try {
        const { error } = await supabaseClient.from('tasks').insert([{ user_id: currentUser.id, title: title, scheduled_date: getViewingDateString() }]);
        if (error) throw error;
        taskModal.classList.add('hidden');
        document.getElementById('addTaskForm').reset();
        await loadTasksForDate();
    } catch (err) { console.error(err); }
});

// FRIEND SEARCH FIX (Case Insensitive)
if(friendsBtn) friendsBtn.addEventListener('click', () => { friendsModal.classList.remove('hidden'); loadLeaderboard(); });
if(document.getElementById('closeFriendsBtn')) document.getElementById('closeFriendsBtn').addEventListener('click', () => { friendsModal.classList.add('hidden'); });

if(searchFriendBtn) {
    searchFriendBtn.addEventListener('click', async () => {
        const query = friendSearchInput.value.trim();
        if (!query) return;
        searchFriendBtn.textContent = '...';
        try {
            // Changed from .eq to .ilike so "Shahid.t" works even if typed as "shahid.t"
            const { data, error } = await supabaseClient.from('profiles').select('id, username').ilike('username', query);
            if (error || !data || data.length === 0) throw new Error('User not found');
            
            const friend = data[0];
            if (friend.id === currentUser.id) throw new Error('Cannot add yourself');
            
            friendSearchResult.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                <strong>${friend.username}</strong><button onclick="sendFriendRequest('${friend.id}')" class="btn-primary" style="margin: 0; padding: 6px 14px; font-size: 12px; width: auto;">Add</button></div>`;
        } catch (err) {
            friendSearchResult.innerHTML = `<p class="error-message">User not found.</p>`;
        } finally {
            searchFriendBtn.textContent = 'Search';
        }
    });
}

window.sendFriendRequest = async (receiverId) => {
    try {
        const { error } = await supabaseClient.from('friendships').insert([{ requester_id: currentUser.id, receiver_id: receiverId }]);
        if (error) throw error;
        friendSearchResult.innerHTML = `<p style="color: var(--success); font-weight: bold;">Added to leaderboard!</p>`;
        await loadLeaderboard();
    } catch (err) { friendSearchResult.innerHTML = `<p class="error-message">Already on leaderboard!</p>`; }
};

async function loadLeaderboard() {
    if(!leaderboardList) return;
    try {
        const { data: friends } = await supabaseClient.from('friendships').select('receiver_id').eq('requester_id', currentUser.id);
        const friendIds = friends ? friends.map(f => f.receiver_id) : [];
        friendIds.push(currentUser.id);

        const { data: profiles } = await supabaseClient.from('profiles').select('username, level, streak_current, id').in('id', friendIds).order('streak_current', { ascending: false });
        
        leaderboardList.innerHTML = '';
        profiles.forEach((p, index) => {
            const isMe = p.id === currentUser.id;
            const card = document.createElement('div');
            card.className = 'task-card';
            if (isMe) card.style.borderLeft = '4px solid var(--primary-color)';
            card.innerHTML = `<div style="display: flex; justify-content: space-between; width: 100%;">
                <span style="font-weight: bold;">#${index + 1} <span style="font-weight: normal; margin-left: 8px;">${p.username}</span></span>
                <span>🔥 ${p.streak_current} | Lvl ${p.level}</span></div>`;
            leaderboardList.appendChild(card);
        });
    } catch (err) { console.error(err); }
}