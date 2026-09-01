const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const switchModeBtn = document.getElementById('switchMode');
const formTitle = document.getElementById('formTitle');
const switchText = document.getElementById('switchText');
const authError = document.getElementById('authError');
const emailGroup = document.getElementById('emailGroup');
const userLabel = document.getElementById('userLabel');

let isLogin = false;

// Check if already logged in (Remember Me)
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = 'pages/dashboard.html';
});

switchModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    if (authError) authError.classList.add('hidden');

    if (isLogin) {
        formTitle.textContent = 'Log In';
        submitBtn.textContent = 'Enter Mentor';
        switchText.textContent = "Don't have an account?";
        switchModeBtn.textContent = 'Sign Up';
        emailGroup.classList.add('hidden'); 
        emailInput.removeAttribute('required');
        userLabel.textContent = "Email or Username";
    } else {
        formTitle.textContent = 'Sign Up';
        submitBtn.textContent = 'Create Account';
        switchText.textContent = 'Already have an account?';
        switchModeBtn.textContent = 'Log In';
        emailGroup.classList.remove('hidden');
        emailInput.setAttribute('required', 'true');
        userLabel.textContent = "Username";
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = usernameInput.value.trim();
    const password = passwordInput.value;
    const email = emailInput.value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    if (authError) authError.classList.add('hidden');

    try {
        if (isLogin) {
            let loginEmail = identifier;
            // If they typed a username, fetch the email associated with it
            if (!identifier.includes('@')) {
                const { data, error: fetchErr } = await supabaseClient.from('profiles').select('id').eq('username', identifier).single();
                if (fetchErr || !data) throw new Error("Username not found.");
                // We use a custom RPC or proxy for security in prod, but for now we try signing in via Supabase's native handlers if supported, or error out asking for email.
                throw new Error("Please log in using your Email for now."); 
            }
            
            const { error } = await supabaseClient.auth.signInWithPassword({ email: loginEmail, password });
            if (error) throw error;
            window.location.href = 'pages/dashboard.html';
            
        } else {
            // Sign Up
            const { data: existingUser } = await supabaseClient.from('profiles').select('id').eq('username', identifier).single();
            if (existingUser) throw new Error("Username already taken.");

            const { error, data } = await supabaseClient.auth.signUp({
                email: email,
                password,
                options: { data: { username: identifier } }
            });
            if (error) throw error;
            
            // Auto-login
            window.location.href = 'pages/dashboard.html';
        }
    } catch (error) {
        authError.textContent = error.message;
        authError.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Enter Mentor' : 'Create Account';
    }
});