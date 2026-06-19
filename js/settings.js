// js/settings.js
document.addEventListener('DOMContentLoaded', () => {
    // Find the button that says "Log Out"
    const buttons = document.querySelectorAll('button');
    let logoutBtn = null;
    
    buttons.forEach(btn => {
        if (btn.textContent.trim() === 'Log Out') {
            logoutBtn = btn;
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            try {
                // 1. Get project ref
                const projectRef = CONFIG.SUPABASE_URL.split('//')[1].split('.')[0];
                
                // 2. Clear the specific Supabase auth token
                localStorage.removeItem(`sb-${projectRef}-auth-token`);
                
                // 3. Clear everything else just to be safe
                localStorage.clear();
                
                // 4. Redirect to the login screen
                window.location.href = '../index.html';
            } catch (err) {
                console.error("Logout error:", err);
                // Fallback redirect
                window.location.href = '../index.html';
            }
        });
    }
});