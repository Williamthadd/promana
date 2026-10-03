// Authentication hardening regression tests (static + unit).
// Runs offline with node:test — no Firebase project or network needed.
// Live emulator/E2E flows are specified in SECURITY_TEST_PLAN.md.

import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const loginPage = fs.readFileSync(path.join(projectRoot, 'src/pages/LoginPage.jsx'), 'utf8')
const firebaseJs = fs.readFileSync(path.join(projectRoot, 'src/firebase.js'), 'utf8')
const driveAuth = fs.readFileSync(path.join(projectRoot, 'src/utils/googleDriveAuth.js'), 'utf8')
const ipFetcher = fs.readFileSync(path.join(projectRoot, 'src/utils/ipFetcher.js'), 'utf8')
const vercelConfig = fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8')
const rules = fs.readFileSync(path.join(projectRoot, 'firestore.rules'), 'utf8')
const driveFilesApi = fs.readFileSync(path.join(projectRoot, 'api/drive-files.js'), 'utf8')

// Import the pure helpers (no Firebase network needed at import time).
import {
  getAuthDebugSuffix,
  getAuthErrorMessage,
  normalizeEmail,
  MIN_SIGNUP_PASSWORD_LENGTH,
} from '../src/utils/authErrors.js'

test('login failures are enumeration-safe and generic', () => {
  for (const code of [
    'auth/invalid-credential',
    'auth/wrong-password',
    'auth/user-not-found',
    'auth/invalid-email',
  ]) {
    const message = getAuthErrorMessage({ code })
    assert.equal(message, 'Unable to sign in with those credentials.')
  }
  assert.doesNotMatch(getAuthErrorMessage({ code: 'auth/user-not-found' }), /no account/i)
  assert.doesNotMatch(getAuthErrorMessage({ code: 'auth/wrong-password' }), /password is incorrect/i)
})

test('signup duplicate does not confirm account existence', () => {
  const message = getAuthErrorMessage({ code: 'auth/email-already-in-use' })
  assert.doesNotMatch(message, /already registered/i)
  assert.ok(message.toLowerCase().includes('unable to create'))
})

test('config failures name the code and the owner fix, without account disclosure', () => {
  // These codes are identical for every email, so naming them cannot reveal
  // whether an account exists — and hiding them left owners with no path to
  // unblock users.
  const expectations = {
    'auth/unauthorized-domain': /authorized domains/i,
    'auth/operation-not-allowed': /sign-in method/i,
  }
  for (const [code, fixPattern] of Object.entries(expectations)) {
    const message = getAuthErrorMessage({ code, message: 'Something unexpected happened.' })
    assert.match(message, new RegExp(`\\(${code}\\)`))
    assert.match(message, fixPattern)
    assert.doesNotMatch(message, /no account|already registered|password is incorrect/i)
  }

  // `auth/internal-error` intentionally has no dedicated message (owner
  // request): it falls through to the generic failure text. This asserts the
  // fallthrough — it does not and cannot change the Firebase rejection.
  assert.equal(
    getAuthErrorMessage({ code: 'auth/internal-error', message: 'Something unexpected happened.' }),
    'Authentication failed. Please try again.',
  )
})

test('throttling is reported truthfully even under a generic error code', () => {
  const throttled = getAuthErrorMessage({ code: 'auth/too-many-requests' })
  assert.match(throttled, /too many sign-in attempts/i)
  assert.match(throttled, /without retrying/i)

  // Firebase sometimes surfaces the same block as internal-error.
  for (const message of [
    'Firebase: We have blocked all requests from this device due to unusual activity. Try again later. (auth/too-many-requests).',
    'Firebase: We have blocked all requests from this device due to unusual activity. Try again later. (auth/internal-error).',
    'TOO_MANY_ATTEMPTS_TRY_LATER',
  ]) {
    const mapped = getAuthErrorMessage({ code: 'auth/internal-error', message })
    assert.equal(mapped, throttled)
  }

  // An internal-error WITHOUT throttling signals falls through to the
  // generic message (no dedicated internal-error text by owner request).
  assert.equal(
    getAuthErrorMessage({ code: 'auth/internal-error', message: 'Something unexpected happened.' }),
    'Authentication failed. Please try again.',
  )
})

test('owner debug suffix stays hidden unless explicitly enabled', () => {
  assert.equal(getAuthDebugSuffix({ code: 'auth/internal-error', message: 'boom' }, false), '')
  assert.match(
    getAuthDebugSuffix({ code: 'auth/internal-error', message: 'boom' }, true),
    /auth\/internal-error.*boom/,
  )
})

test('no client-side login lockout exists', () => {
  // The submit guard must reset after every attempt (finally), and there
  // must be no attempt counter / lockout timer in the login flow.
  assert.match(loginPage, /finally\s*\{[\s\S]*?releaseGuard\(\)/)
  assert.doesNotMatch(loginPage, /attempts\s*\+\+|attemptCount|lockoutUntil|lockedUntil|MAX_ATTEMPTS/i)
})

test('email is normalized before Firebase calls', () => {
  assert.equal(normalizeEmail('  Dev@Example.com  '), 'Dev@Example.com')
  assert.ok(loginPage.includes('normalizeEmail(email)'))
})

test('signup enforces a strong minimum password length', () => {
  assert.ok(MIN_SIGNUP_PASSWORD_LENGTH >= 12)
  assert.ok(loginPage.includes('MIN_SIGNUP_PASSWORD_LENGTH'))
  assert.ok(loginPage.includes('At least'))
})

test('Google flow has redirect fallback and consumes redirect results', () => {
  assert.ok(loginPage.includes('signInWithRedirect'))
  assert.ok(loginPage.includes('getRedirectResult'))
  assert.ok(loginPage.includes('Continue with Google redirect'))
})

test('Google sign-in uses incremental authorization (no Drive scope at login)', () => {
  // The restricted Drive scope at sign-in time can fail the whole Google
  // consent and break login. It is requested later in connectGoogleDrive().
  assert.ok(!loginPage.includes('addScope'))
  assert.ok(!loginPage.includes('GOOGLE_DRIVE_SCOPE'))
  assert.ok(!loginPage.includes('saveGoogleDriveAccessToken'))
  assert.ok(driveAuth.includes('addScope'))
})

test('disabled accounts get an actionable message', () => {
  assert.match(
    getAuthErrorMessage({ code: 'auth/user-disabled' }),
    /\(auth\/user-disabled\)/,
  )
})

test('auth attempts are guarded against concurrent submission', () => {
  assert.ok(loginPage.includes('authInProgress'))
  assert.ok(loginPage.includes('guardConcurrent'))
})

test('password state is cleared after attempts and never persisted', () => {
  assert.ok(loginPage.includes("setPassword('')"))
  assert.doesNotMatch(loginPage, /localStorage.*password|sessionStorage.*password/i)
  assert.doesNotMatch(loginPage, /console\.(log|error).*password/i)
})

test('third-party IP fetching is removed from the auth flow', () => {
  assert.ok(!loginPage.includes("from '../utils/ipFetcher'"))
  assert.ok(!loginPage.includes('fetchIpAddress('))
  assert.ok(!loginPage.includes('api.ipify.org'))
  assert.ok(ipFetcher.includes('DEPRECATED'))
})

test('client audit writes no longer assert network identity', () => {
  assert.ok(!loginPage.match(/writeLoginLog\(\{\s*uid[^}]*ipAddress/s))
  assert.ok(loginPage.includes('No client IP is collected'))
})

test('production CSP permits the Firebase/Google auth handshake', () => {
  const csp = JSON.parse(vercelConfig).headers
    .find((entry) => entry.source === '/(.*)')
    .headers.find((header) => header.key === 'Content-Security-Policy').value
  assert.ok(csp.includes('https://*.firebaseapp.com'))
  assert.ok(csp.includes('https://accounts.google.com'))
  assert.ok(!csp.includes('api.ipify.org'))
  assert.match(csp, /frame-src[^;]*accounts\.google\.com/)
  assert.match(csp, /frame-src[^;]*firebaseapp\.com/)
})

test('session persistence is explicit and offline-compatible', () => {
  assert.ok(firebaseJs.includes('browserLocalPersistence'))
  assert.ok(firebaseJs.includes('setPersistence'))
})

test('email verification and password reset lifecycle exists', () => {
  assert.ok(loginPage.includes('sendEmailVerification'))
  assert.ok(loginPage.includes('sendPasswordResetEmail'))
  assert.ok(loginPage.includes('Resend verification'))
  assert.ok(loginPage.includes('If an account matches that address'))
})

test('Drive scope decision is documented and enforced server-side', () => {
  assert.ok(driveAuth.includes('https://www.googleapis.com/auth/drive'))
  assert.ok(driveAuth.includes('drive.file'))
  assert.ok(driveFilesApi.includes('emailVerified'))
  assert.ok(driveFilesApi.includes('promanUserId'))
})

test('login audit logs stay append-only and per-UID isolated', () => {
  const block = rules.slice(rules.indexOf('loginLogs'))
  assert.match(block.slice(0, 1200), /allow update, delete:\s*if false/)
  assert.match(block, /isOwner\(userId\)/)
})
