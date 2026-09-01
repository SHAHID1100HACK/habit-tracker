const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const datePicker = document.getElementById('datePicker');
const greetingEl = document.getElementById('greeting');
const taskModal = document.getElementById('taskModal');
const habitListEl = document.getElementById('habitList');
const oneTimeListEl = document.getElementById('oneTimeList');
const taskProgressText = document.getElementById('taskProgressText');
const progressPercent = document.getElementById('progressPercent');
const friendSearchInput = document.getElementById('friendSearchInput');
const friendSearchResult = document.getElementById('friendSearchResult');
const leaderboardList = document.getElementById('leaderboardList');
const pendingRequestsContainer = document.getElementById('pendingRequestsContainer');
const pendingRequestsList = document.getElementById('pendingRequestsList');
const searchFriendBtn = document.getElementById('searchFriendBtn');
const friendsBtn = document.getElementById('friendsBtn');
const friendsModal = document.getElementById('friendsModal');
const userInitialEl = document.getElementById('userInitial');

let currentUser = null;

// Initialize Date Picker
const today = new Date();
const offset = today.getTimezoneOffset() * 60000;
const localISOTime = (new Date(today - offset)).toISOString().split('T')[0];
if(datePicker) datePicker.value = localISOTime;

if(datePicker) {
    datePicker.addEventListener('change', () => {
        if(currentUser) loadTasksForDate();
    });
}

function getViewingDateString() { return datePicker.value; }

// Auth Check
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
        if (userInitialEl) userInitialEl.textContent = data.username.charAt(0).toUpperCase();
        
        document.getElementById('userLevel').textContent = data.level || 1;
        document.getElementById('userStreak').textContent = data.streak_current || 0;
    } catch (err) { console.error(err); }
}

// Tasks Logic
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
    } catch (err) { console.error(err); }
}

function renderTasks(tasks) {
    if(!habitListEl || !oneTimeListEl) return;
    
    habitListEl.innerHTML = ''; 
    oneTimeListEl.innerHTML = '';

    let completedCount = 0;
    let habitCount = 0;
    let oneTimeCount = 0;

    if (tasks && tasks.length > 0) {
        tasks.forEach(task => {
            if (task.is_completed) completedCount++;
            
            const card = document.createElement('div');
            card.className = `task-card ${task.is_completed ? 'completed' : ''}`;
            card.innerHTML = `<div class="task-checkbox">${task.is_completed ? '✓' : ''}</div><span class="task-title">${task.title}</span>`;
            card.onclick = () => toggleTaskComplete(task.id, task.is_completed, card);
            card.style.cursor = 'pointer';
            
            // Route to correct list based on task_type
            if (task.task_type === 'one-time') {
                oneTimeListEl.appendChild(card);
                oneTimeCount++;
            } else {
                habitListEl.appendChild(card);
                habitCount++;
            }
        });
    }

    if (habitCount === 0) habitListEl.innerHTML = '<p class="empty-state">No habits scheduled.</p>';
    if (oneTimeCount === 0) oneTimeListEl.innerHTML = '<p class="empty-state">No action items scheduled for today.</p>';

    const totalTasks = habitCount + oneTimeCount;
    if(taskProgressText) taskProgressText.textContent = `${completedCount} of ${totalTasks} Completed`;
    if(progressPercent) progressPercent.textContent = totalTasks > 0 ? `${Math.round((completedCount / totalTasks) * 100)}%` : '0%';
}

async function toggleTaskComplete(taskId, currentlyCompleted, cardElement) {
    cardElement.style.pointerEvents = 'none';
    cardElement.style.opacity = '0.5';
    try {
        if (currentlyCompleted) {
            const { error } = await supabaseClient.from('tasks').update({ is_completed: false }).eq('id', taskId);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.rpc('complete_task_and_award_xp', { p_task_id: taskId, p_user_id: currentUser.id });
            if (error) throw error;
        }
        await loadUserProfile();
        await loadTasksForDate();
    } catch (err) {
        console.error(err);
        cardElement.style.pointerEvents = 'auto';
        cardElement.style.opacity = '1';
    }
}

document.getElementById('fabAdd')?.addEventListener('click', () => taskModal.classList.remove('hidden'));
document.getElementById('closeModalBtn')?.addEventListener('click', () => taskModal.classList.add('hidden'));

document.getElementById('addTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('taskTitle').value.trim();
    const type = document.getElementById('taskType').value;
    
    if (!title) return;
    try {
        const { error } = await supabaseClient.from('tasks').insert([{ 
            user_id: currentUser.id, 
            title: title, 
            scheduled_date: getViewingDateString(),
            task_type: type
        }]);
        if (error) throw error;
        taskModal.classList.add('hidden');
        document.getElementById('addTaskForm').reset();
        await loadTasksForDate();
    } catch (err) { console.error(err); }
});

// FRIEND SYSTEM LOGIC
if(friendsBtn) friendsBtn.addEventListener('click', () => { 
    friendsModal.classList.remove('hidden'); 
    loadLeaderboard(); 
});
if(document.getElementById('closeFriendsBtn')) document.getElementById('closeFriendsBtn').addEventListener('click', () => { 
    friendsModal.classList.add('hidden'); 
    friendSearchResult.innerHTML = '';
});

// 1. Search
if(searchFriendBtn) {
    searchFriendBtn.addEventListener('click', async () => {
        const query = friendSearchInput.value.trim();
        if (!query) return;
        searchFriendBtn.textContent = '...';
        try {
            const { data, error } = await supabaseClient.from('profiles').select('id, username').ilike('username', query);
            if (error || !data || data.length === 0) throw new Error('User not found');
            const friend = data[0];
            if (friend.id === currentUser.id) throw new Error('Cannot add yourself');
            
            friendSearchResult.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                <strong>${friend.username}</strong><button onclick="sendFriendRequest('${friend.id}')" class="btn-primary" style="margin: 0; padding: 6px 14px; font-size: 12px; width: auto;">Add</button></div>`;
        } catch (err) {
            friendSearchResult.innerHTML = `<p class="error-message">${err.message}</p>`;
        } finally {
            searchFriendBtn.textContent = 'Search';
        }
    });
}

// 2. Send Request
window.sendFriendRequest = async (receiverId) => {
    try {
        const { error } = await supabaseClient.from('friendships').insert([{ 
            requester_id: currentUser.id, 
            receiver_id: receiverId,
            status: 'pending'
        }]);
        if (error) throw error;
        friendSearchResult.innerHTML = `<p style="color: var(--success); font-weight: bold;">Request sent!</p>`;
    } catch (err) { 
        friendSearchResult.innerHTML = `<p class="error-message">Request already pending or accepted.</p>`; 
    }
};

// 3. Accept/Decline/Remove Handlers
window.acceptRequest = async (friendshipId) => {
    try {
        await supabaseClient.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
        await loadLeaderboard();
    } catch (err) { console.error(err); }
};

window.declineRequest = async (friendshipId) => {
    try {
        await supabaseClient.from('friendships').delete().eq('id', friendshipId);
        await loadLeaderboard();
    } catch (err) { console.error(err); }
};

window.removeFriend = async (friendshipId) => {
    if (!confirm("Remove this friend from your leaderboard?")) return;
    try {
        await supabaseClient.from('friendships').delete().eq('id', friendshipId);
        await loadLeaderboard();
    } catch (err) { console.error(err); }
};

// 4. Load Both Leaderboard and Inbox
async function loadLeaderboard() {
    if(!leaderboardList) return;
    try {
        const { data: friendships } = await supabaseClient
            .from('friendships')
            .select('*')
            .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

        let friendIds = [currentUser.id];
        let pendingRequests = [];
        let friendshipMap = {};

        if (friendships) {
            friendships.forEach(f => {
                if (f.status === 'accepted') {
                    const friendId = f.requester_id === currentUser.id ? f.receiver_id : f.requester_id;
                    friendIds.push(friendId);
                    friendshipMap[friendId] = f.id;
                } else if (f.status === 'pending' && f.receiver_id === currentUser.id) {
                    pendingRequests.push(f);
                }
            });
        }

        if (pendingRequests.length > 0) {
            pendingRequestsContainer.classList.remove('hidden');
            pendingRequestsList.innerHTML = '';
            
            const requesterIds = pendingRequests.map(r => r.requester_id);
            const { data: requesterProfiles } = await supabaseClient.from('profiles').select('id, username').in('id', requesterIds);

            pendingRequests.forEach(req => {
                const profile = requesterProfiles?.find(p => p.id === req.requester_id);
                if(!profile) return;

                const card = document.createElement('div');
                card.className = 'task-card';
                card.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-weight: bold;">${profile.username}</span>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="acceptRequest('${req.id}')" class="btn-primary" style="padding: 4px 12px; font-size: 12px; width: auto; margin:0;">Accept</button>
                        <button onclick="declineRequest('${req.id}')" class="btn-secondary" style="padding: 4px 12px; font-size: 12px; width: auto; margin:0; border: 1px solid var(--danger); color: var(--danger);">Decline</button>
                    </div>
                </div>`;
                pendingRequestsList.appendChild(card);
            });
        } else {
            pendingRequestsContainer.classList.add('hidden');
        }

        const { data: profiles } = await supabaseClient.from('profiles').select('username, level, streak_current, id').in('id', friendIds).order('streak_current', { ascending: false });
        
        leaderboardList.innerHTML = '';
        profiles.forEach((p, index) => {
            const isMe = p.id === currentUser.id;
            const card = document.createElement('div');
            card.className = 'task-card';
            if (isMe) card.style.borderLeft = '4px solid var(--primary-color)';
            
            let removeBtnHTML = '';
            if (!isMe) {
                const fId = friendshipMap[p.id];
                removeBtnHTML = `<button onclick="removeFriend('${fId}')" style="background: none; border: none; color: var(--danger); font-size: 16px; margin-left: 12px; cursor: pointer;" title="Remove Friend">✖</button>`;
            }

            card.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span style="font-weight: bold;">#${index + 1} <span style="font-weight: normal; margin-left: 8px;">${p.username}</span></span>
                <div style="display: flex; align-items: center;">
                    <span>🔥 ${p.streak_current} | Lvl ${p.level}</span>
                    ${removeBtnHTML}
                </div>
            </div>`;
            leaderboardList.appendChild(card);
        });
    } catch (err) { console.error(err); }
}