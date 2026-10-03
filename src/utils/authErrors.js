// Pure authentication helpers: safe to import in Node tests (no JSX,
// no Firebase network). LoginPage.jsx re-exports these for compatibility.

export const MIN_SIGNUP_PASSWORD_LENGTH = 12

// Enumeration-safe error messages: login failures never reveal whether the
// email exists. Infrastructure details stay in developer logs, never in UI.
//
// NOTE on throttling: Firebase enforces brute-force protection server-side
// ("blocked all requests from this device due to unusual activity"). No
// client code can lift that block — and none of ours adds to it: there is no
// client-side attempt counter or lockout, the submit guard resets after every
// attempt, and the /api/log-auth-error rate limit only drops log writes.
// Firebase usually reports throttling as `auth/too-many-requests`, but the
// same condition sometimes surfaces under `auth/internal-error`, so the raw
// message is also checked for throttling signals below.
const THROTTLING_MESSAGE =
  'Too many sign-in attempts. Sign-in is briefly paused to protect your account. Wait a few minutes without retrying, then try again once.'

function looksLikeThrottling(error, code) {
  if (code === 'auth/too-many-requests') {
    return true
  }

  const message = String(error?.message ?? '').toLowerCase()
  return (
    message.includes('too many') ||
    message.includes('too_many') ||
    message.includes('blocked all requests') ||
    (message.includes('block') && message.includes('unusual activity')) ||
    (message.includes('try again later') && message.includes('device'))
  )
}

export function getAuthErrorMessage(error) {
  const code = error?.code ?? ''

  if (looksLikeThrottling(error, code)) {
    return THROTTLING_MESSAGE
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email' ||
    code === 'auth/missing-password' ||
    code === 'auth/missing-email'
  ) {
    return 'Unable to sign in with those credentials.'
  }

  if (code === 'auth/email-already-in-use') {
    return 'Unable to create that account. If you already have an account, try signing in.'
  }

  if (code === 'auth/weak-password') {
    return `Choose a stronger password with at least ${MIN_SIGNUP_PASSWORD_LENGTH} characters. Longer passphrases are welcome.`
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled'
  ) {
    return 'Google sign-in was closed before it finished. Try again when ready.'
  }

  if (code === 'auth/popup-blocked') {
    return 'The Google sign-in popup was blocked by the browser. Allow popups for this site, or use the redirect option below.'
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'Unable to sign in with Google for this email. Try the original sign-in method first.'
  }

  if (code === 'auth/network-request-failed') {
    return 'The network request failed while contacting the sign-in service. Check your connection and try again.'
  }

  if (code === 'auth/multi-factor-auth-required') {
    return 'Additional verification is required for this account. Complete the second step to continue.'
  }

  // Project-configuration failures. These codes are identical for every
  // email address, so naming them does NOT reveal whether an account exists.
  // They are shown explicitly (instead of a generic "unavailable" message)
  // because a generic message leaves the owner with no path to unblock
  // users — and the underlying rejection comes from Firebase either way.
  if (code === 'auth/unauthorized-domain') {
    return 'Sign-in is blocked for this domain (auth/unauthorized-domain). Owner fix: Firebase Console → Authentication → Settings → Authorized domains → add the domain you are signing in from.'
  }

  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in method is disabled for the project (auth/operation-not-allowed). Owner fix: Firebase Console → Authentication → Sign-in method → enable Email/Password and Google.'
  }

  if (code === 'auth/internal-error') {
    return 'Sign-in failed before completing (auth/internal-error). If wrong passwords were retried many times, wait a few minutes without retrying, then try once. Otherwise, owner checks: the Firebase API key must allow the Identity Toolkit + Secure Token APIs, the OAuth consent screen must be configured, and the browser must allow third-party cookies and popups.'
  }

  return 'Authentication failed. Please try again.'
}

// Owner-only diagnostics suffix. Appended to the UI error only when the URL
// carries `?debug=auth`, so the owner can paste the exact Firebase error
// without opening devtools, while normal users never see internals.
export function getAuthDebugSuffix(error, debugEnabled) {
  if (!debugEnabled) {
    return ''
  }

  const code = error?.code ?? 'unknown-code'
  const message = String(error?.message ?? 'no message').slice(0, 300)
  return `\n\nDetails: ${code} — ${message}`
}

export function isAuthDebugEnabled() {
  try {
    return (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === 'auth'
    )
  } catch {
    return false
  }
}

export function normalizeEmail(value) {
  return String(value ?? '').trim()
}
