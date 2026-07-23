// Word Coach Ultra - Clean Auth, Only Hi Name, No Supabase/HTTPS/github.io errors, Online-only login
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
const SUPABASE_URL = 'https://bwjoqomechsubjvwwbbk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3am9xb21lY2hzdWJqdnd3YmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjI2MDksImV4cCI6MjEwMDIzODYwOX0.b23oGlmu3u9iGeMpA0LAULpCoDUl17_MTgu9XA4S5k4'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function cleanError(e) {
  let msg = (e && e.message) ? e.message : (e ? e.toString() : 'Please try again')
  msg = msg.replace(/https?:\/\/[^\s]+/g, '')
  msg = msg.replace(/supabase/gi, '')
  msg = msg.replace(/github\.io/gi, '')
  msg = msg.replace(/github/gi, '')
  msg = msg.replace(/sk-or-v1-[a-zA-Z0-9\-_]+/g, '')
  msg = msg.replace(/eyJhbGci[^\s]+/g, '')
  msg = msg.trim()
  if (msg.length > 80) msg = 'Please check your details and try again'
  if (!msg) msg = 'Please try again'
  return msg
}

async function sendOtp(email, name) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: email.toLowerCase(), name }),
  })
  const data = await res.json()
  if (!data.success) throw new Error('Could not send code')
  return data
}

async function verifyOtp(email, otp, name, password) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: email.toLowerCase(), otp, name, password }),
  })
  const data = await res.json()
  if (!data.success) throw new Error('Invalid code')
  return data
}

async function signUp(name, email, password) {
  if (!navigator.onLine) throw new Error('Please connect to internet')
  await sendOtp(email, name)
  showOtpModal(email, name, password)
}

function showOtpModal(email, name, password) {
  const modal = document.createElement('div')
  modal.id = 'otp-modal'
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `<div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%;text-align:center"><h2 style="margin:0 0 8px">Check your email</h2><p style="color:#333;font-size:13px">Hi ${name}! Code sent to<br><strong>${email}</strong></p><div style="display:flex;gap:8px;justify-content:center;margin:20px 0">${[0,1,2,3,4,5].map(i => `<input id="otp-${i}" maxlength="1" style="width:40px;height:48px;text-align:center;font-size:20px;font-weight:bold;border:2px solid #ddd;border-radius:8px" />`).join('')}</div><button id="verify-otp-btn" style="background:#7c3aed;color:white;border:none;padding:12px 24px;border-radius:8px;width:100%;font-weight:bold;cursor:pointer">Verify</button><p style="font-size:11px;color:#666;margin-top:12px">After verification: Hi ${name}! Welcome</p><button id="close-otp" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer">Cancel</button></div>`
  document.body.appendChild(modal)
  for (let i = 0; i < 6; i++) {
    const input = document.getElementById(`otp-${i}`)
    input.addEventListener('input', (e) => {
      if (e.target.value && i < 5) document.getElementById(`otp-${i+1}`).focus()
      if (Array.from(document.querySelectorAll('#otp-modal input')).every(inp => inp.value)) document.getElementById('verify-otp-btn').click()
    })
    input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !e.target.value && i > 0) document.getElementById(`otp-${i-1}`).focus() })
  }
  document.getElementById('otp-0').focus()
  document.getElementById('close-otp').onclick = () => modal.remove()
  document.getElementById('verify-otp-btn').onclick = async () => {
    const otp = Array.from(document.querySelectorAll('#otp-modal input')).map(inp => inp.value).join('')
    if (otp.length !== 6) { alert('Enter 6-digit code'); return }
    const btn = document.getElementById('verify-otp-btn')
    btn.textContent = 'Verifying...'; btn.disabled = true
    try {
      await verifyOtp(email, otp, name, password)
      const { error } = await supabase.auth.signUp({ email: email.toLowerCase(), password, options: { data: { name, username: name.toLowerCase().replace(/\s+/g,'_'), email: email.toLowerCase() } } })
      try { await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password }) } catch (_) {}
      modal.remove()
      const banner = document.getElementById('auth-banner')
      if (banner) banner.innerHTML = `<div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center;font-weight:bold">Hi ${name}! 👋 Welcome</div>`
      setTimeout(() => location.reload(), 1000)
    } catch (e) {
      alert(cleanError(e))
      btn.textContent = 'Verify'; btn.disabled = false
    }
  }
}

async function login(email, password) {
  if (!navigator.onLine) throw new Error('Please connect to internet to login. Login works online only.')
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password })
  if (error) throw new Error(cleanError(error))
  return data
}

async function logout() { await supabase.auth.signOut(); location.reload() }

async function initAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    const authBanner = document.getElementById('auth-banner')
    if (user) {
      const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'there'
      if (authBanner) authBanner.innerHTML = `<div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center;font-weight:bold;font-size:14px">Hi ${displayName}! 👋</div>`
    } else {
      if (authBanner) authBanner.innerHTML = `<div style="background:#fff3e0;padding:8px 12px;border-radius:8px;font-size:12px;text-align:center">Hi! <button onclick="showLoginModal()" style="background:#7c3aed;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer">Login</button> <button onclick="showSignupModal()" style="background:white;color:#7c3aed;border:1px solid #7c3aed;padding:4px 12px;border-radius:4px;cursor:pointer;margin-left:6px">Sign Up</button></div>`
    }
  } catch (e) {
    const authBanner = document.getElementById('auth-banner')
    if (authBanner) authBanner.innerHTML = `<div style="background:#fff3e0;padding:8px 12px;border-radius:8px;font-size:12px;text-align:center">Hi! Please login</div>`
  }
}

function showLoginModal() {
  const modal = document.createElement('div')
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `<div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%"><h2 style="margin:0 0 12px">Login</h2><p style="font-size:11px;color:#666">Online only when logging in</p><input id="login-email" placeholder="Email" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:8px" /><input id="login-pass" type="password" placeholder="Password" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:8px" /><button id="login-btn" style="background:#7c3aed;color:white;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:12px">Login</button><button id="close-login" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer;width:100%">Cancel</button></div>`
  document.body.appendChild(modal)
  document.getElementById('close-login').onclick = () => modal.remove()
  document.getElementById('login-btn').onclick = async () => {
    const email = document.getElementById('login-email').value
    const pass = document.getElementById('login-pass').value
    if (!navigator.onLine) { alert('Please connect to internet to login. Login works online only.'); return }
    try {
      await login(email, pass)
      modal.remove()
      const name = email.split('@')[0]
      const banner = document.getElementById('auth-banner')
      if (banner) banner.innerHTML = `<div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center;font-weight:bold">Hi ${name}! 👋</div>`
      setTimeout(() => location.reload(), 800)
    } catch (e) { alert(cleanError(e)) }
  }
}

function showSignupModal() {
  const modal = document.createElement('div')
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `<div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%"><h2 style="margin:0 0 12px">Create Account</h2><input id="su-name" placeholder="Name" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" /><input id="su-email" placeholder="Email" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" /><input id="su-pass" type="password" placeholder="Password" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" /><input id="su-confirm" type="password" placeholder="Confirm Password" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" /><button id="su-btn" style="background:#7c3aed;color:white;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:12px">Sign Up & Send Code from AI Super Agent</button><button id="close-su" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer;width:100%">Cancel</button></div>`
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
    if (!navigator.onLine) { alert('Please connect to internet. Sign up works online only.'); return }
    const btn = document.getElementById('su-btn')
    btn.textContent = 'Sending code...'; btn.disabled = true
    try { await signUp(name, email, pass); modal.remove() } catch (e) { alert(cleanError(e)); btn.textContent = 'Sign Up & Send Code from AI Super Agent'; btn.disabled = false }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('auth-banner')) {
    const banner = document.createElement('div')
    banner.id = 'auth-banner'
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;padding:4px'
    document.body.prepend(banner)
    document.body.style.paddingTop = '50px'
  }
  initAuth()
})

window.showLoginModal = showLoginModal
window.showSignupModal = showSignupModal
window.logout = logout
