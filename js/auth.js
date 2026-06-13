// js/auth.js
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const usernameGroup = document.getElementById('usernameGroup');
const submitBtn = document.getElementById('submitBtn');
const switchModeBtn = document.getElementById('switchMode');
const formTitle = document.getElementById('formTitle');
const switchText = document.getElementById('switchText');

let isLogin = false; // Start in Sign Up mode

// Toggle between Login and Sign Up
switchModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    
    if (isLogin) {
        formTitle.textContent = 'Log In';
        submitBtn.textContent = 'Enter Mentor';
        switchText.textContent = "Don't have an account?";
        switchModeBtn.textContent = 'Sign Up';
        usernameGroup.style.display = 'none'; // Hide username on login
        usernameInput.removeAttribute('required');
    } else {
        formTitle.textContent = 'Sign Up';
        submitBtn.textContent = 'Create Account';
        switchText.textContent = 'Already have an account?';
        switchModeBtn.textContent = 'Log In';
        usernameGroup.style.display = 'block'; // Show username on signup
        usernameInput.setAttribute('required', 'true');
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim();
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    try {
        if (isLogin) {
            // LOGIN FLOW
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.href = 'pages/dashboard.html';
            
        } else {
            // SIGN UP FLOW
            const { error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { username: username } // Sends the username to your Supabase profiles table!
                }
            });
            if (error) throw error;
            
            alert('Account created! You can now log in.');
            switchModeBtn.click(); // Switch to login mode
        }
    } catch (error) {
        alert(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Enter Mentor' : 'Create Account';
    }
});