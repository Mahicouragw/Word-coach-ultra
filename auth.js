// Word Coach Ultra - Clean Auth, Only Hi Name, No Supabase/HTTPS/github.io errors, Online-only login
// v2.0.0: accessible dialogs (role=dialog, aria-modal, focus trap, Escape),
// inline error text instead of alert(), explicit Verify (no auto-submit).
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

/* ---------- accessible modal helpers (v2.0.0) ---------- */
let activeModal = null
function focusables(modal) {
  return Array.from(modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.disabled && el.offsetParent !== null)
}
function trapFocus(e) {
  if (!activeModal) return
  if (e.key === 'Escape') { closeModal(); return }
  if (e.key !== 'Tab') return
  const list = focusables(activeModal)
  if (!list.length) return
  const first = list[0], last = list[list.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function openModal(modal, titleId) {
  closeModal()
  activeModal = modal
  modal.hidden = false
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  if (titleId) modal.setAttribute('aria-labelledby', titleId)
  document.addEventListener('keydown', trapFocus)
  const first = focusables(modal)[0]
  if (first) setTimeout(() => first.focus(), 30)
}
function closeModal() {
  if (!activeModal) return
  activeModal.hidden = true
  activeModal = null
  document.removeEventListener('keydown', trapFocus)
}
function showError(containerId, message) {
  const box = document.getElementById(containerId)
  if (!box) return
  box.textContent = message
  box.hidden = false
  box.setAttribute('role', 'alert')
}

/* ---------- OTP flow ---------- */
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
  modal.className = 'wcu-modal'
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `<div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%;text-align:center" role="document" aria-labelledby="otp-title">
    <h2 id="otp-title" style="margin:0 0 8px">Check your email</h2>
    <p style="color:#333;font-size:13px">Hi ${name}! Code sent to<br><strong>${email}</strong></p>
    <div style="display:flex;gap:8px;justify-content:center;margin:20px 0" role="group" aria-label="6 digit code">
      ${[0,1,2,3,4,5].map(i => `<input id="otp-${i}" maxlength="1" inputmode="numeric" aria-label="Digit ${i+1} of 6" style="width:40px;height:48px;text-align:center;font-size:20px;font-weight:bold;border:2px solid #ddd;border-radius:8px" />`).join('')}
    </div>
    <p id="otp-error" hidden style="color:#b3261e;font-size:13px;min-height:1em"></p>
    <button id="verify-otp-btn" style="background:#7c3aed;color:white;border:none;padding:12px 24px;border-radius:8px;width:100%;font-weight:bold;cursor:pointer">Verify</button>
    <p style="font-size:11px;color:#666;margin-top:12px">After verification: Hi ${name}! Welcome</p>
    <button id="close-otp" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer">Cancel</button>
  </div>`
  document.body.appendChild(modal)
  for (let i = 0; i < 6; i++) {
    const input = document.getElementById(`otp-${i}`)
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '')
      if (e.target.value && i < 5) document.getElementById(`otp-${i+1}`).focus()
      // no auto-submit: the user explicitly presses Verify (TalkBack friendly)
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) document.getElementById(`otp-${i-1}`).focus()
    })
  }
  document.getElementById('close-otp').onclick = () => closeModal()
  document.getElementById('verify-otp-btn').onclick = async () => {
    const digits = Array.from(document.querySelectorAll('#otp-modal input')).map(inp => inp.value)
    const otp = digits.join('')
    if (otp.length !== 6) { showError('otp-error', 'Enter the full 6-digit code.'); return }
    const btn = document.getElementById('verify-otp-btn')
    btn.textContent = 'Verifying...'; btn.disabled = true
    try {
      await verifyOtp(email, otp, name, password)
      const { error } = await supabase.auth.signUp({ email: email.toLowerCase(), password, options: { data: { name, username: name.toLowerCase().replace(/\s+/g,'_'), email: email.toLowerCase() } } })
      if (error) throw error
      try { await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password }) } catch (_) {}
      closeModal(); modal.remove()
      const banner = document.getElementById('auth-banner')
      if (banner) banner.innerHTML = `<div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center;font-weight:bold">Hi ${name}! 👋 Welcome</div>`
      setTimeout(() => location.reload(), 1000)
    } catch (e) {
      showError('otp-error', cleanError(e))
      btn.textContent = 'Verify'; btn.disabled = false
    }
  }
  openModal(modal, 'otp-title')
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

function modalShell(title) {
  const modal = document.createElement('div')
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999'
  modal.innerHTML = `<div style="background:white;padding:24px;border-radius:12px;max-width:400px;width:90%" role="document" aria-labelledby="auth-modal-title">
    <h2 id="auth-modal-title" style="margin:0 0 12px">${title}</h2>
    <div id="auth-modal-body"></div>
  </div>`
  document.body.appendChild(modal)
  return modal
}

function showLoginModal() {
  const modal = modalShell('Login')
  const body = document.getElementById('auth-modal-body')
  body.innerHTML = `<p style="font-size:11px;color:#666">Online only when logging in</p>
    <input id="login-email" placeholder="Email" type="email" aria-label="Email" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:8px" />
    <input id="login-pass" type="password" placeholder="Password" aria-label="Password" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:8px" />
    <p id="login-error" hidden style="color:#b3261e;font-size:13px;min-height:1em"></p>
    <button id="login-btn" style="background:#7c3aed;color:white;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:12px">Login</button>
    <button id="close-login" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer;width:100%">Cancel</button>`
  document.getElementById('close-login').onclick = () => closeModal()
  const submit = async () => {
    const email = document.getElementById('login-email').value.trim()
    const pass = document.getElementById('login-pass').value
    if (!email || !pass) { showError('login-error', 'Enter your email and password.'); return }
    if (!navigator.onLine) { showError('login-error', 'Please connect to internet to login. Login works online only.'); return }
    const btn = document.getElementById('login-btn')
    btn.textContent = 'Logging in...'; btn.disabled = true
    try {
      await login(email, pass)
      closeModal(); modal.remove()
      const name = email.split('@')[0]
      const banner = document.getElementById('auth-banner')
      if (banner) banner.innerHTML = `<div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center;font-weight:bold">Hi ${name}! 👋</div>`
      setTimeout(() => location.reload(), 800)
    } catch (e) {
      showError('login-error', cleanError(e))
      btn.textContent = 'Login'; btn.disabled = false
    }
  }
  document.getElementById('login-btn').onclick = submit
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  openModal(modal, 'auth-modal-title')
}

function showSignupModal() {
  const modal = modalShell('Create Account')
  const body = document.getElementById('auth-modal-body')
  body.innerHTML = `<input id="su-name" placeholder="Name" aria-label="Name" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
    <input id="su-email" placeholder="Email" type="email" aria-label="Email" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
    <input id="su-pass" type="password" placeholder="Password" aria-label="Password" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
    <input id="su-confirm" type="password" placeholder="Confirm Password" aria-label="Confirm password" style="width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:8px" />
    <p id="su-error" hidden style="color:#b3261e;font-size:13px;min-height:1em"></p>
    <button id="su-btn" style="background:#7c3aed;color:white;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:12px">Sign Up & Send Code from AI Super Agent</button>
    <button id="close-su" style="margin-top:12px;background:none;border:none;color:#666;cursor:pointer;width:100%">Cancel</button>`
  document.getElementById('close-su').onclick = () => closeModal()
  const submit = async () => {
    const name = document.getElementById('su-name').value.trim()
    const email = document.getElementById('su-email').value.trim()
    const pass = document.getElementById('su-pass').value
    const confirm = document.getElementById('su-confirm').value
    if (!name || !email || !pass) { showError('su-error', 'Fill all fields'); return }
    if (pass !== confirm) { showError('su-error', 'Passwords do not match'); return }
    if (pass.length < 6) { showError('su-error', 'Minimum 6 characters'); return }
    if (!navigator.onLine) { showError('su-error', 'Please connect to internet. Sign up works online only.'); return }
    const btn = document.getElementById('su-btn')
    btn.textContent = 'Sending code...'; btn.disabled = true
    try { await signUp(name, email, pass); closeModal(); modal.remove() }
    catch (e) { showError('su-error', cleanError(e)); btn.textContent = 'Sign Up & Send Code from AI Super Agent'; btn.disabled = false }
  }
  document.getElementById('su-btn').onclick = submit
  document.getElementById('su-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  openModal(modal, 'auth-modal-title')
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
