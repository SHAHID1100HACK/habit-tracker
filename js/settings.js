// js/settings.js
console.log("HabitMentor Settings Initializing...");

const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const logoutBtn = document.getElementById('logoutBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const usernameInput = document.getElementById('usernameInput');
const uploadStatus = document.getElementById('uploadStatus');

let currentUser = null;

// Auth Guard
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || !session.user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    await loadCurrentProfile();
});

// Load current username into the input box
async function loadCurrentProfile() {
    if (!usernameInput || !currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;
        if (data && data.username) {
            usernameInput.value = data.username;
        }
    } catch (err) {
        console.error("Failed to load profile:", err);
    }
}

// Handle Username Update
if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        const newUsername = usernameInput.value.trim();
        if (!newUsername) return;

        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Saving...";
        
        if (uploadStatus) {
            uploadStatus.style.color = "var(--text-primary)";
            uploadStatus.textContent = "Updating profile...";
        }

        try {
            // Check if the username is already taken by someone else
            const { data: existingUser } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('username', newUsername)
                .neq('id', currentUser.id)
                .single();

            if (existingUser) {
                throw new Error("That username is already taken!");
            }

            // Update the profile in the database
            const { error } = await supabaseClient
                .from('profiles')
                .update({ 
                    username: newUsername,
                    username_changed_at: new Date().toISOString() 
                })
                .eq('id', currentUser.id);

            if (error) throw error;

            if (uploadStatus) {
                uploadStatus.style.color = "var(--success)";
                uploadStatus.textContent = "Username updated successfully!";
            }
        } catch (err) {
            console.error("Update error:", err);
            if (uploadStatus) {
                uploadStatus.style.color = "var(--danger)";
                uploadStatus.textContent = err.message || "Failed to update username.";
            }
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = "Save Changes";
            
            // Clear status message after 3 seconds
            setTimeout(() => {
                if (uploadStatus) uploadStatus.textContent = "";
            }, 3000);
        }
    });
}

// Secure Logout using Supabase SDK
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            logoutBtn.textContent = "Logging out...";
            logoutBtn.disabled = true;
            
            // Properly invalidate the session on the server
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            
            // The onAuthStateChange listener will automatically redirect to index.html
        } catch (err) {
            console.error("Logout error:", err);
            // Fallback redirect just in case
            window.location.href = '../index.html';
        }
    });
}