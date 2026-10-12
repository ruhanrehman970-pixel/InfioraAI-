import {
  acceptInvite,
  getSettings,
  getUser,
  handleAuthCallback,
  login,
  oauthLogin,
  requestPasswordRecovery,
  signup,
  updateUser,
  type AuthProvider,
} from '@netlify/identity'
import { authErrorMessage, hasAuthCallback, toast } from './ui'

type Mode = 'signup' | 'login'
type View = 'auth' | 'forgot' | 'reset' | 'check'

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))

const authForm = $<HTMLFormElement>('[data-form="auth"]')
const tabs = $('.tabs')
const submitBtn = $<HTMLButtonElement>('[data-submit]')
const passwordInput = $<HTMLInputElement>('#password')
let mode: Mode = 'signup'
let inviteToken: string | null = null

function showView(view: View) {
  $$('[data-view]').forEach((el) => (el.hidden = el.dataset.view !== view))
  $$('[data-msg]').forEach((el) => setMsg(el, ''))
}

function setMode(next: Mode) {
  mode = next
  tabs.dataset.mode = next
  $$<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === next)))
  $$('[data-signup-only]').forEach((el) => (el.hidden = next !== 'signup'))
  $$('[data-login-only]').forEach((el) => (el.hidden = next !== 'login'))
  $('[data-title]').textContent = next === 'signup' ? 'Create your account' : 'Welcome back'
  $('[data-subtitle]').textContent =
    next === 'signup' ? 'Free forever. No card required.' : 'Log in to pick up where you left off.'
  submitBtn.textContent = next === 'signup' ? 'Create account' : 'Log in'
  passwordInput.autocomplete = next === 'signup' ? 'new-password' : 'current-password'
  history.replaceState(null, '', `/account?mode=${next}`)
  showView('auth')
}

function setMsg(el: HTMLElement, text: string, kind: 'error' | 'success' = 'error') {
  el.textContent = text
  el.className = `form-msg ${kind}`
}

async function busy<T>(btn: HTMLButtonElement, label: string, fn: () => Promise<T>) {
  const original = btn.textContent
  btn.disabled = true
  btn.textContent = label
  try {
    return await fn()
  } finally {
    btn.disabled = false
    btn.textContent = original
  }
}

function validEmail(input: HTMLInputElement) {
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())
  input.setAttribute('aria-invalid', String(!ok))
  return ok
}

function validPassword(input: HTMLInputElement) {
  const ok = input.value.length >= 8
  input.setAttribute('aria-invalid', String(!ok))
  return ok
}

const goToDashboard = () => location.assign('/dashboard')

// --- sign up / log in ---
$$<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.tab as Mode)))
$$<HTMLButtonElement>('[data-go]').forEach((b) =>
  b.addEventListener('click', () => {
    const target = b.dataset.go!
    if (target === 'forgot') {
      $<HTMLInputElement>('#forgot-email').value = $<HTMLInputElement>('#email').value
      showView('forgot')
    } else setMode(target as Mode)
  }),
)

authForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const msg = $('[data-msg]', authForm)
  const emailInput = $<HTMLInputElement>('#email')
  const data = new FormData(authForm)
  const email = emailInput.value.trim()
  const password = passwordInput.value

  if (!validEmail(emailInput)) return setMsg(msg, 'Please enter a valid email address.')
  if (mode === 'signup' && !validPassword(passwordInput)) return setMsg(msg, 'Your password needs at least 8 characters.')
  if (mode === 'login' && !password) return setMsg(msg, 'Please enter your password.')
  setMsg(msg, '')

  await busy(submitBtn, mode === 'signup' ? 'Creating account…' : 'Logging in…', async () => {
    try {
      if (mode === 'login') {
        await login(email, password)
        return goToDashboard()
      }
      const user = await signup(email, password, {
        full_name: String(data.get('name') || '').trim() || undefined,
        account_type: data.get('accountType'),
        preferred_language: data.get('language'),
      })
      if (user.confirmedAt) return goToDashboard()
      $('[data-check-email]').textContent = email
      showView('check')
    } catch (error) {
      setMsg(msg, authErrorMessage(error))
    }
  })
})

// --- forgot password ---
const forgotForm = $<HTMLFormElement>('[data-form="forgot"]')
forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const msg = $('[data-msg]', forgotForm)
  const input = $<HTMLInputElement>('#forgot-email')
  if (!validEmail(input)) return setMsg(msg, 'Please enter a valid email address.')
  await busy($<HTMLButtonElement>('button[type="submit"]', forgotForm), 'Sending…', async () => {
    try {
      await requestPasswordRecovery(input.value.trim())
      setMsg(msg, 'If an account exists for that email, a reset link is on its way.', 'success')
    } catch (error) {
      setMsg(msg, authErrorMessage(error))
    }
  })
})

// --- set new password (recovery or invite) ---
const resetForm = $<HTMLFormElement>('[data-form="reset"]')
resetForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const msg = $('[data-msg]', resetForm)
  const input = $<HTMLInputElement>('#new-password')
  if (!validPassword(input)) return setMsg(msg, 'Your password needs at least 8 characters.')
  await busy($<HTMLButtonElement>('button[type="submit"]', resetForm), 'Saving…', async () => {
    try {
      if (inviteToken) await acceptInvite(inviteToken, input.value)
      else await updateUser({ password: input.value })
      goToDashboard()
    } catch (error) {
      setMsg(msg, authErrorMessage(error))
    }
  })
})

// --- OAuth buttons, shown only for providers enabled on the project ---
async function setupOAuth() {
  try {
    const settings = await getSettings()
    if (settings.disableSignup && mode === 'signup') setMode('login')
    let any = false
    $$<HTMLButtonElement>('[data-provider]').forEach((btn) => {
      const provider = btn.dataset.provider as AuthProvider
      if (settings.providers?.[provider]) {
        btn.hidden = false
        any = true
        btn.addEventListener('click', () => oauthLogin(provider))
      }
    })
    $('[data-oauth]').hidden = !any
    $('[data-oauth-divider]').hidden = !any
  } catch {
    // Settings unavailable: email sign-in still works.
  }
}

// --- startup ---
async function init() {
  const params = new URLSearchParams(location.search)
  setMode(params.get('mode') === 'login' ? 'login' : 'signup')

  if (hasAuthCallback()) {
    try {
      const result = await handleAuthCallback()
      switch (result?.type) {
        case 'recovery':
          return showView('reset')
        case 'invite':
          inviteToken = result.token ?? null
          $('[data-view="reset"] h1').textContent = 'Accept your invitation'
          $('[data-view="reset"] .sub').textContent = 'Choose a password to activate your Nexora account.'
          return showView('reset')
        case 'confirmation':
          toast('Email confirmed. Welcome to Nexora!')
          return setTimeout(goToDashboard, 900)
        case 'oauth':
        case 'email_change':
          return goToDashboard()
      }
    } catch (error) {
      setMsg($('[data-msg]', authForm), authErrorMessage(error))
    }
  } else if (params.get('mode') !== 'reset' && (await getUser())) {
    return goToDashboard()
  }

  setupOAuth()
}

init()
