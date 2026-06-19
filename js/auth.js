// js/auth.js
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const authForm = document.getElementById('authForm');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
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
    } else {
        formTitle.textContent = 'Sign Up';
        submitBtn.textContent = 'Create Account';
        switchText.textContent = 'Already have an account?';
        switchModeBtn.textContent = 'Log In';
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    // THE TRICK: Secretly format the username as an email so Supabase accepts it
    const dummyEmail = `${username.toLowerCase()}@habitmentor.local`;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    try {
        if (isLogin) {
            // LOGIN FLOW
            const { error } = await supabaseClient.auth.signInWithPassword({ email: dummyEmail, password });
            if (error) throw error;
            window.location.href = 'pages/dashboard.html';
            
        } else {
            // SIGN UP FLOW
            const { error } = await supabaseClient.auth.signUp({
                email: dummyEmail,
                password,
                options: {
                    data: { username: username } 
                }
            });
            if (error) throw error;
            
            alert('Account created! You can now log in.');
            switchModeBtn.click(); // Switch to login mode automatically
        }
    } catch (error) {
        // Show invalid login messages
        alert(error.message);
    } finally {
        // THIS FIXES THE FROZEN BUTTON: It will always re-enable
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Enter Mentor' : 'Create Account';
    }
});