// Supabase Auth for Word Coach Ultra - Email, Username, Password, Confirm + Email/Password Login Only
// Uses same Supabase project bwjoqomechsubjvwwbbk Mumbai, OTP from AI Super Agent via Resend
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = 'https://bwjoqomechsubjvwwbbk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3am9xb21lY2hzdWJqdnd3YmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjI2MDksImV4cCI6MjEwMDIzODYwOX0.b23oGlmu3u9iGeMpA0LAULpCoDUl17_MTgu9XA4S5k4'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// OTP Service - sends 6-digit code from AI Super Agent via Resend (free)
async function sendOtp(email, name) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: email.toLowerCase(), name }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'Failed to send OTP')
  return data
}

async function verifyOtp(email, otp, name, password) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: email.toLowerCase(), otp, name, password }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Invalid OTP')
  return data
}

// Sign up - Name, Email, Password, Confirm - OTP from AI Super Agent
async function signUp(name, email, password) {
  // First send OTP from AI Super Agent
  await sendOtp(email, name)
  // Show OTP modal
  showOtpModal(email, name, password)
}

function showOtpModal(email, name, password) {
  const modal = document.createElement('div')
  modal.id = 'otp-modal'
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `
    <div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%;text-align:center">
      <h2 style="margin:0 0 12px">Check your email</h2>
      <p style="color:#666;font-size:13px">We sent 6-digit code from AI Super Agent to<br><strong>${email}</strong><br>(like Gmail verification)</p>
      <div style="display:flex;gap:8px;justify-content:center;margin:20px 0">
        ${[0,1,2,3,4,5].map(i => `<input id="otp-${i}" maxlength="1" style="width:40px;height:48px;text-align:center;font-size:20px;font-weight:bold;border:2px solid #ddd;border-radius:8px" />`).join('')}
      </div>
      <button id="verify-otp-btn" style="background:#7c3aed;color:white;border:none;padding:12px 24px;border-radius:8px;width:100%;font-weight:bold;cursor:pointer">Verify & Go to Dashboard</button>
      <p style="font-size:11px;color:#999;margin-top:12px">After verification, directly to dashboard with prompt box, model chooser (Claude, GPT-4o, Groq, Gemini), chat like ChatGPT</p>
      <button id="close-otp" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer">Cancel</button>
    </div>
  `
  document.body.appendChild(modal)
  
  // Auto focus and auto move
  for (let i = 0; i < 6; i++) {
    const input = document.getElementById(`otp-${i}`)
    input.addEventListener('input', (e) => {
      if (e.target.value && i < 5) document.getElementById(`otp-${i+1}`).focus()
      if (document.querySelectorAll('#otp-modal input').length === 6 && Array.from(document.querySelectorAll('#otp-modal input')).every(inp => inp.value)) {
        document.getElementById('verify-otp-btn').click()
      }
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) document.getElementById(`otp-${i-1}`).focus()
    })
  }
  document.getElementById('otp-0').focus()
  
  document.getElementById('close-otp').onclick = () => modal.remove()
  
  document.getElementById('verify-otp-btn').onclick = async () => {
    const otp = Array.from(document.querySelectorAll('#otp-modal input')).map(inp => inp.value).join('')
    if (otp.length !== 6) {
      alert('Enter 6-digit code')
      return
    }
    const btn = document.getElementById('verify-otp-btn')
    btn.textContent = 'Verifying...'
    btn.disabled = true
    try {
      await verifyOtp(email, otp, name, password)
      // Create Supabase user
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: { data: { name, username: name.toLowerCase().replace(/\s+/g,'_'), email: email.toLowerCase() } }
      })
      if (error && !error.message.includes('already')) throw error
      // Try sign in
      try {
        await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password })
      } catch (_) {}
      modal.remove()
      alert('✅ Verified! Welcome to Word Coach Ultra - TalkBack accessible, with AI Super Agent models')
      location.reload()
    } catch (e) {
      alert('Verification failed: ' + e.message)
      btn.textContent = 'Verify & Go to Dashboard'
      btn.disabled = false
    }
  }
}

// Login - just email and password
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password })
  if (error) throw error
  return data
}

async function logout() {
  await supabase.auth.signOut()
  location.reload()
}

// Check auth on load, show login if not logged in, but allow offline mode
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  const authBanner = document.getElementById('auth-banner')
  if (user) {
    if (authBanner) authBanner.innerHTML = `<div style="background:#e8f5e9;padding:8px 12px;border-radius:8px;font-size:12px">Welcome ${user.user_metadata?.name || user.email} | <button onclick="logout()" style="background:none;border:none;color:#7c3aed;cursor:pointer;text-decoration:underline">Logout</button> | Model: <select id="model-chooser" style="font-size:11px"><option>GPT-4o Mini (Fast, Cheap) ✅ No credit limit</option><option>GPT-4o</option><option>Groq Llama Grow 🚀</option><option>Mixtral Installed Group 🔀</option><option>Gemini Free 💎</option></select></div>`
    // Model chooser works like LMArena - saves to localStorage for offline without reinstall
    const chooser = document.getElementById('model-chooser')
    if (chooser) {
      const saved = localStorage.getItem('selected_model') || 'openai/gpt-4o-mini'
      chooser.value = saved
      chooser.onchange = (e) => {
        localStorage.setItem('selected_model', e.target.value)
        // Also save to Supabase remote config for all apps without reinstall
        supabase.from('offline_cache').upsert({ email: user.email, app_name: 'word-coach-ultra', data_key: 'selected_model', data_value: { model: e.target.value } })
        alert('Model changed to ' + e.target.value + ' - Works like LMArena, no credit limit!')
      }
    }
  } else {
    // Show login/signup banner, but offline cache allows play without internet
    if (authBanner) authBanner.innerHTML = `<div style="background:#fff3e0;padding:8px 12px;border-radius:8px;font-size:12px">Offline mode - Login for AI features: <button onclick="showLoginModal()" style="background:#7c3aed;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer">Login: Email + Password Only</button> <button onclick="showSignupModal()" style="background:white;color:#7c3aed;border:1px solid #7c3aed;padding:4px 12px;border-radius:4px;cursor:pointer;margin-left:6px">Sign Up: Name, Email, Password</button> | Works offline after login, no reinstall needed via Supabase remote config</div>`
  }
}

function showLoginModal() {
  const modal = document.createElement('div')
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `
    <div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%">
      <h2 style="margin:0 0 12px">Login - Just Email & Password</h2>
      <p style="font-size:11px;color:#666">AI Super Agent style - No Supabase messages, just email & password</p>
      <input id="login-email" placeholder="Email" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:8px" />
      <input id="login-pass" type="password" placeholder="Password" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:8px" />
      <button id="login-btn" style="background:#7c3aed;color:white;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:12px">Login & Go to Dashboard</button>
      <button id="close-login" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer;width:100%">Cancel</button>
    </div>
  `
  document.body.appendChild(modal)
  document.getElementById('close-login').onclick = () => modal.remove()
  document.getElementById('login-btn').onclick = async () => {
    const email = document.getElementById('login-email').value
    const pass = document.getElementById('login-pass').value
    try {
      await login(email, pass)
      modal.remove()
      alert('✅ Logged in! Dashboard with prompt box, model chooser Claude/GPT/Groq/Gemini, chat like ChatGPT, generate images/videos/songs/lyrics')
      location.reload()
    } catch (e) {
      alert('Login failed: ' + e.message)
    }
  }
}

function showSignupModal() {
  const modal = document.createElement('div')
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `
    <div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%">
      <h2 style="margin:0 0 6px">Create Account - Just Name, Email, Password</h2>
      <p style="font-size:11px;color:#7c3aed;background:#f3e8ff;padding:6px;border-radius:4px">🤖 Sends 6-digit code from AI Super Agent (not Supabase) like Gmail/Google</p>
      <input id="su-name" placeholder="Name" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
      <input id="su-email" placeholder="Email" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
      <input id="su-pass" type="password" placeholder="Password" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
      <input id="su-confirm" type="password" placeholder="Confirm Password" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
      <button id="su-btn" style="background:#7c3aed;color:white;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:12px">Sign Up & Send 6-Digit Code from AI Super Agent</button>
      <button id="close-su" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer;width:100%">Cancel</button>
    </div>
  `
  document.body.appendChild(modal)
  document.getElementById('close-su').onclick = () => modal.remove()
  document.getElementById('su-btn').onclick = async () => {
    const name = document.getElementById('su-name').value
    const email = document.getElementById('su-email').value
    const pass = document.getElementById('su-pass').value
    const confirm = document.getElementById('su-confirm').value
    if (!name || !email || !pass) { alert('Fill all fields'); return }
    if (pass !== confirm) { alert('Passwords do not match'); return }
    if (pass.length < 6) { alert('Min 6 chars'); return }
    const btn = document.getElementById('su-btn')
    btn.textContent = 'Sending code from AI Super Agent...'
    btn.disabled = true
    try {
      await signUp(name, email, pass)
      modal.remove()
    } catch (e) {
      alert('Signup failed: ' + e.message)
      btn.textContent = 'Sign Up & Send 6-Digit Code from AI Super Agent'
      btn.disabled = false
    }
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  // Add auth banner to top of page if not exists
  if (!document.getElementById('auth-banner')) {
    const banner = document.createElement('div')
    banner.id = 'auth-banner'
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;padding:4px'
    document.body.prepend(banner)
    // Push content down
    document.body.style.paddingTop = '50px'
  }
  initAuth()
})

window.showLoginModal = showLoginModal
window.showSignupModal = showSignupModal
window.logout = logout
