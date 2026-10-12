import { AuthError, MissingIdentityError } from '@netlify/identity'

export function toast(message: string, ms = 4200) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')
  el.textContent = message
  document.body.append(el)
  setTimeout(() => el.remove(), ms)
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof MissingIdentityError) {
    return 'Accounts are not available right now. Please try again shortly.'
  }
  if (error instanceof AuthError) {
    if (/not confirmed/i.test(error.message)) return 'Please confirm your email first. Check your inbox for the link.'
    switch (error.status) {
      case 400:
      case 401:
        return 'That email and password combination is not correct.'
      case 403:
        return 'New sign-ups are currently closed.'
      case 422:
        return /registered|exists/i.test(error.message)
          ? 'An account with this email already exists. Try logging in.'
          : 'Please check your email and password and try again.'
      case 429:
        return 'Too many attempts. Please wait a minute and try again.'
    }
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

/** Auth callback links (email confirmation, recovery, invites, OAuth) carry a token in the URL hash. */
export const hasAuthCallback = () => /(confirmation|recovery|invite|email_change)_token=|access_token=|error=/.test(location.hash)
