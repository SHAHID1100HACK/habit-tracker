const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const logoutBtn = document.getElementById('logoutBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const usernameInput = document.getElementById('usernameInput');
const uploadStatus = document.getElementById('uploadStatus');
const avatarUpload = document.getElementById('avatarUpload');
const avatarPreview = document.getElementById('avatarPreview');

let currentUser = null;
let selectedFile = null;

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session || !session.user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = session.user;
    await loadCurrentProfile();
});

async function loadCurrentProfile() {
    if (!usernameInput || !currentUser) return;
    try {
        const { data, error } = await supabaseClient.from('profiles').select('username, avatar_url').eq('id', currentUser.id).single();
        if (error) throw error;
        
        if (data.username) usernameInput.value = data.username;
        if (data.avatar_url) {
            avatarPreview.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            avatarPreview.textContent = data.username ? data.username.charAt(0).toUpperCase() : '?';
        }
    } catch (err) { console.error("Failed to load profile:", err); }
}

// Handle File Selection Preview
if (avatarUpload) {
    avatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarPreview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Handle Save Button
if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        const newUsername = usernameInput.value.trim();
        if (!newUsername) return;

        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Saving...";
        uploadStatus.style.color = "var(--text-primary)";
        uploadStatus.textContent = "Updating profile...";

        try {
            // 1. Check Username Availability
            const { data: existingUser } = await supabaseClient.from('profiles').select('id').eq('username', newUsername).neq('id', currentUser.id).single();
            if (existingUser) throw new Error("That username is already taken!");

            let publicAvatarUrl = null;

            // 2. Upload Image if Selected
            if (selectedFile) {
                uploadStatus.textContent = "Uploading image...";
                const fileExt = selectedFile.name.split('.').pop();
                const filePath = `${currentUser.id}/avatar.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, selectedFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
                publicAvatarUrl = publicUrl;
            }

            // 3. Update Database Profile
            const updates = { username: newUsername };
            if (publicAvatarUrl) updates.avatar_url = publicAvatarUrl;

            const { error: updateErr } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id);
            if (updateErr) throw updateErr;

            uploadStatus.style.color = "var(--success)";
            uploadStatus.textContent = "Profile updated successfully!";
            selectedFile = null; // reset
        } catch (err) {
            uploadStatus.style.color = "var(--danger)";
            uploadStatus.textContent = err.message || "Failed to update profile.";
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = "Save Changes";
            setTimeout(() => { uploadStatus.textContent = ""; }, 3000);
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            logoutBtn.textContent = "Logging out...";
            logoutBtn.disabled = true;
            await supabaseClient.auth.signOut();
        } catch (err) { window.location.href = '../index.html'; }
    });
}