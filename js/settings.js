// js/settings.js
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const uploadStatus = document.getElementById('uploadStatus');
const usernameInput = document.getElementById('usernameInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;
let currentProfile = null;

// Auth Guard
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    await loadProfile();
});

// Load Current Data
async function loadProfile() {
    try {
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
        if (error) throw error;
        currentProfile = data;
        usernameInput.value = data.username || '';
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// Save Changes
saveProfileBtn.addEventListener('click', async () => {
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Saving...";
    uploadStatus.textContent = "";

    try {
        const newUsername = usernameInput.value.trim();
        let usernameChangedAt = currentProfile.username_changed_at;

        // Enforce 30-day username rule
        if (newUsername !== currentProfile.username) {
            if (currentProfile.username_changed_at) {
                const daysSince = (new Date() - new Date(currentProfile.username_changed_at)) / (1000 * 60 * 60 * 24);
                if (daysSince < 30) {
                    throw new Error(`You can only change your username once a month. Try again in ${Math.ceil(30 - daysSince)} days.`);
                }
            }
            usernameChangedAt = new Date().toISOString();
        } else {
            uploadStatus.textContent = "No changes made.";
            uploadStatus.style.color = "var(--text-secondary)";
            return;
        }

        // Update Database
        const { error: updateError } = await supabaseClient.from('profiles').update({
            username: newUsername,
            username_changed_at: usernameChangedAt
        }).eq('id', currentUser.id);

        if (updateError) throw updateError;

        uploadStatus.textContent = "Username updated successfully!";
        uploadStatus.style.color = "var(--primary-color)";
        await loadProfile();

    } catch (err) {
        console.error(err);
        uploadStatus.textContent = err.message || "Failed to update profile.";
        uploadStatus.style.color = "red";
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "Save Changes";
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '../index.html';
});