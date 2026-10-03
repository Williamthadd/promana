import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { LoaderCircle, QrCode, WifiOff } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BackgroundColorControl from '../components/BackgroundColorControl'
import BrandMark from '../components/BrandMark'
import MadeByFooter from '../components/MadeByFooter'
import { auth, db } from '../firebase'
import useAuth from '../hooks/useAuth'
import useConnectivity from '../features/offline-mode/useConnectivity'
import useLightBackgroundColor from '../hooks/useLightBackgroundColor'
import reportAuthFailure from '../utils/authFailureReporter'
import {
  getAuthDebugSuffix,
  getAuthErrorMessage,
  isAuthDebugEnabled,
  MIN_SIGNUP_PASSWORD_LENGTH,
  normalizeEmail,
} from '../utils/authErrors'

const MAX_EMAIL_LENGTH = 254
const MAX_PASSWORD_LENGTH = 1024
const VERIFICATION_RESEND_COOLDOWN_MS = 60_000

// Builds the user-facing error text. Normal users see the safe message;
// with `?debug=auth` in the URL the owner additionally sees the exact
// Firebase code + message for support/debugging.
function toUserError(error) {
  return `${getAuthErrorMessage(error)}${getAuthDebugSuffix(error, isAuthDebugEnabled())}`
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.805 10.023h-9.81v3.955h5.624c-.242 1.273-.968 2.35-2.06 3.075v2.55h3.327c1.947-1.792 3.064-4.435 3.064-7.58 0-.674-.06-1.32-.145-2z"
        fill="#4285F4"
      />
      <path
        d="M11.995 22c2.775 0 5.102-.92 6.803-2.397l-3.327-2.55c-.924.621-2.103.988-3.476.988-2.672 0-4.936-1.804-5.746-4.225H2.81v2.632A10.284 10.284 0 0 0 11.995 22z"
        fill="#34A853"
      />
      <path
        d="M6.249 13.816a6.188 6.188 0 0 1-.321-1.816c0-.63.114-1.24.321-1.816V7.552H2.81A10.282 10.282 0 0 0 1.75 12c0 1.647.393 3.208 1.06 4.448l3.439-2.632z"
        fill="#FBBC05"
      />
      <path
        d="M11.995 5.959c1.508 0 2.864.52 3.93 1.54l2.95-2.95C17.092 2.894 14.765 2 11.995 2A10.284 10.284 0 0 0 2.81 7.552l3.439 2.632c.81-2.42 3.074-4.225 5.746-4.225z"
        fill="#EA4335"
      />
    </svg>
  )
}

// Developer-only diagnostics: never rendered in the UI. Helps distinguish
// Firebase console misconfiguration (authorized domains, providers, API key
// restrictions, OAuth consent) from user errors.
function logAuthDiagnostics(error, method) {
  try {
    const code = error?.code ?? 'unknown'
    if (
      code === 'auth/internal-error' ||
      code === 'auth/unauthorized-domain' ||
      code === 'auth/operation-not-allowed'
    ) {
      console.debug('[AUTH_DIAGNOSTICS]', {
        method,
        code,
        origin:
          typeof window !== 'undefined' ? window.location.origin : 'unknown',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'unknown',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'unknown',
        hint: 'Check Firebase Console: authorized domains include this origin; Google + Email providers enabled; API key allows Identity Toolkit; OAuth consent configured. Also check third-party-cookie / popup blockers.',
      })
    }
  } catch {
    // Diagnostics must never break auth feedback.
  }
}

function isPlausibleEmail(value) {
  if (!value || value.length > MAX_EMAIL_LENGTH) {
    return false
  }
  // Minimal shape check; Firebase remains the authority on identity semantics.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function LoginPage() {
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationNotice, setVerificationNotice] = useState('')
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [lastVerificationSentAt, setLastVerificationSentAt] = useState(0)
  const authInProgress = useRef(false)
  const [darkMode] = useState(
    () => window.localStorage.getItem('proman-theme') === 'dark',
  )
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { isOffline } = useConnectivity()
  const {
    lightBackgroundColor,
    setLightBackgroundColor,
    resetLightBackgroundColor,
  } = useLightBackgroundColor()
  const googleProvider = useMemo(() => {
    // Incremental authorization: sign-in requests NO Drive scope. The full
    // Drive scope is a restricted OAuth scope that can make the consent
    // screen fail (unverified app / access denied) and take down the entire
    // Google login with it. Drive access is requested later, only when the
    // user connects Drive, via connectGoogleDrive() which re-authenticates
    // with the scope (see src/utils/googleDriveAuth.js).
    const provider = new GoogleAuthProvider()
    return provider
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Client audit writes are best-effort and non-authoritative: the UID comes
  // from the verified Firebase user object, the timestamp is server-set via
  // Firestore Timestamp.now(), and network identity is derived server-side in
  // /api/log-auth-error. No client IP is collected (see ipFetcher removal).
  async function writeLoginLog({ uid, method, success }) {
    if (!uid) {
      return
    }

    try {
      await addDoc(collection(db, 'users', uid, 'loginLogs'), {
        timestamp: Timestamp.now(),
        method,
        success,
        userAgent: String(navigator.userAgent ?? '').slice(0, 500),
      })
    } catch {
      // Firestore logging is best-effort here to avoid interrupting auth.
    }
  }

  async function recordAuthAttempt({ uid, method, success, error }) {
    const reports = [writeLoginLog({ uid, method, success })]

    if (!success) {
      reports.push(
        reportAuthFailure({
          method,
          authMode,
          code: error?.code ?? null,
          message: error?.message ?? null,
          emailProvided: method.startsWith('google')
            ? false
            : Boolean(normalizeEmail(email)),
        }),
      )
    }

    await Promise.allSettled(reports)
  }

  function showOfflineAuthMessage() {
    setErrorMessage(
      'You are offline. A new sign-in or account registration needs an internet connection. Previously cached workspace data opens automatically only while your existing Firebase session is still signed in on this device.',
    )
  }

  function guardConcurrent() {
    if (authInProgress.current || loading) {
      return true
    }
    authInProgress.current = true
    return false
  }

  function releaseGuard() {
    authInProgress.current = false
    setLoading(false)
  }

  async function handleEmailSubmit(event) {
    event.preventDefault()

    if (isOffline) {
      showOfflineAuthMessage()
      return
    }

    if (guardConcurrent()) {
      return
    }

    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    const cleanEmail = normalizeEmail(email)
    const method = authMode === 'login' ? 'email-password' : 'email-signup'

    if (!isPlausibleEmail(cleanEmail)) {
      setErrorMessage(
        authMode === 'login'
          ? 'Unable to sign in with those credentials.'
          : 'Enter a valid email address to create an account.',
      )
      void recordAuthAttempt({
        uid: null,
        method,
        success: false,
        error: { code: 'auth/invalid-email' },
      })
      releaseGuard()
      return
    }

    if (
      !password ||
      password.length > MAX_PASSWORD_LENGTH ||
      (authMode === 'signup' && password.length < MIN_SIGNUP_PASSWORD_LENGTH)
    ) {
      setErrorMessage(
        authMode === 'signup'
          ? `Choose a stronger password with at least ${MIN_SIGNUP_PASSWORD_LENGTH} characters. Longer passphrases are welcome.`
          : 'Unable to sign in with those credentials.',
      )
      void recordAuthAttempt({
        uid: null,
        method,
        success: false,
        error: { code: 'auth/weak-password' },
      })
      setPassword('')
      releaseGuard()
      return
    }

    try {
      if (authMode === 'login') {
        const credentials = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password,
        )
        setPassword('')

        if (
          !credentials.user.emailVerified &&
          credentials.user.providerData?.some((p) => p.providerId === 'password')
        ) {
          setVerificationNotice(
            'Your email address is not verified yet. Some features stay limited until verification. Check your inbox, or resend below.',
          )
        }

        // Authentication is the primary action. Audit logging is
        // best-effort and must never delay entry to a successfully opened app.
        void recordAuthAttempt({
          uid: credentials.user.uid,
          method,
          success: true,
        })

        navigate('/dashboard', { replace: true })
      } else {
        const credentials = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password,
        )
        setPassword('')

        try {
          await sendEmailVerification(credentials.user)
          setLastVerificationSentAt(Date.now())
          setVerificationNotice(
            'Account created. We sent a verification email — confirm it before relying on email features. You can continue to the workspace.',
          )
        } catch {
          setVerificationNotice(
            'Account created, but the verification email could not be sent right now. Use Resend below.',
          )
        }

        void recordAuthAttempt({
          uid: credentials.user.uid,
          method,
          success: true,
        })

        navigate('/dashboard', { replace: true })
      }
    } catch (error) {
      logAuthDiagnostics(error, method)
      setErrorMessage(toUserError(error))
      setPassword('')

      void recordAuthAttempt({
        uid: null,
        method,
        success: false,
        error,
      })
    } finally {
      releaseGuard()
    }
  }

  async function handleGoogleLogin() {
    if (isOffline) {
      showOfflineAuthMessage()
      return
    }

    if (guardConcurrent()) {
      return
    }

    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')
    googleProvider.setCustomParameters({ prompt: 'select_account' })

    try {
      const credentials = await signInWithPopup(auth, googleProvider)
      // Deliberately no Drive token is stored here (see redirect handler
      // above): login carries no Drive scope.
      void recordAuthAttempt({
        uid: credentials.user.uid,
        method: 'google',
        success: true,
      })

      navigate('/dashboard', { replace: true })
    } catch (error) {
      logAuthDiagnostics(error, 'google')
      setErrorMessage(toUserError(error))

      void recordAuthAttempt({
        uid: null,
        method: 'google',
        success: false,
        error,
      })
    } finally {
      releaseGuard()
    }
  }

  async function handlePasswordReset(event) {
    event.preventDefault()

    if (isOffline) {
      showOfflineAuthMessage()
      return
    }

    if (guardConcurrent()) {
      return
    }

    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    const cleanEmail = normalizeEmail(email)

    try {
      // Always respond generically so the UI never reveals whether the
      // address has an account.
      if (isPlausibleEmail(cleanEmail)) {
        await sendPasswordResetEmail(auth, cleanEmail)
      }
      setInfoMessage(
        'If an account matches that address, password-reset instructions were sent to the email.',
      )
    } catch (error) {
      logAuthDiagnostics(error, 'password-reset')
      setInfoMessage(
        'If an account matches that address, password-reset instructions were sent to the email.',
      )
      void recordAuthAttempt({
        uid: null,
        method: 'email-reset',
        success: false,
        error,
      })
    } finally {
      releaseGuard()
    }
  }

  async function handleResendVerification() {
    const currentUser = auth.currentUser

    if (!currentUser || verificationBusy) {
      return
    }

    if (Date.now() - lastVerificationSentAt < VERIFICATION_RESEND_COOLDOWN_MS) {
      setVerificationNotice(
        'A verification email was just sent. Please wait a minute before requesting another.',
      )
      return
    }

    setVerificationBusy(true)

    try {
      await sendEmailVerification(currentUser)
      setLastVerificationSentAt(Date.now())
      setVerificationNotice(
        'Verification email sent. Check your inbox (and spam folder).',
      )
    } catch {
      setVerificationNotice(
        'The verification email could not be sent right now. Try again later.',
      )
    } finally {
      setVerificationBusy(false)
    }
  }

  async function handleRefreshVerification() {
    const currentUser = auth.currentUser

    if (!currentUser) {
      return
    }

    setVerificationBusy(true)

    try {
      await currentUser.reload()
      const fresh = auth.currentUser

      if (fresh?.emailVerified) {
        setVerificationNotice('Email verified. Full workspace access enabled.')
      } else {
        setVerificationNotice(
          'Still unverified. Confirm the link in your inbox, then refresh again.',
        )
      }
    } catch {
      setVerificationNotice('Could not refresh verification status right now.')
    } finally {
      setVerificationBusy(false)
    }
  }

  if (authLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center dark:bg-slate-950"
        style={darkMode ? undefined : { backgroundColor: lightBackgroundColor }}
      >
        <LoaderCircle className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-300" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const isResetMode = authMode === 'reset'

  return (
    <div
      className={`relative min-h-screen overflow-hidden px-4 py-12 flex items-center justify-center transition-all duration-500 ${
        darkMode ? 'bg-mesh-dark text-slate-100' : 'bg-mesh-light text-slate-900'
      }`}
      style={darkMode ? undefined : { backgroundColor: lightBackgroundColor }}
    >
      {/* Decorative Neon Glow Blobs */}
      <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/15 animate-pulse duration-5000" />
      <div className="absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl dark:bg-cyan-500/15 animate-pulse duration-5000" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/5" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <BackgroundColorControl
          darkMode={darkMode}
          lightBackgroundColor={lightBackgroundColor}
          onChange={setLightBackgroundColor}
          onReset={resetLightBackgroundColor}
        />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col items-center justify-center z-10">
        <BrandMark
          className="mb-8 hover:scale-105 transition-transform duration-300"
          logoClassName="h-20 w-20 rounded-3xl object-cover shadow-2xl ring-2 ring-blue-500/20 dark:ring-blue-400/30 neon-glow-blue"
          titleClassName="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-600 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white"
        />

        <div className="w-full rounded-3xl p-8 transition-all duration-500 glass-panel-light dark:glass-panel-dark shadow-2xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/5 hover:scale-[1.01] border border-white/40 dark:border-white/10">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">
              Developer Workspace Launcher
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {authMode === 'login'
                ? 'Welcome back'
                : authMode === 'signup'
                  ? 'Create your account'
                  : 'Reset your password'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage your local environments, notes, and targets.
            </p>
          </div>

          {verificationNotice ? (
            <div
              className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
              role="status"
              aria-live="polite"
            >
              <p>{verificationNotice}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={verificationBusy}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  Resend verification
                </button>
                <button
                  type="button"
                  onClick={handleRefreshVerification}
                  disabled={verificationBusy}
                  className="rounded-xl border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/10"
                >
                  I verified — refresh
                </button>
              </div>
            </div>
          ) : null}

          <form
            className="grid gap-5"
            onSubmit={isResetMode ? handlePasswordReset : handleEmailSubmit}
          >
            {isOffline ? (
              <div
                className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                role="status"
                aria-live="polite"
              >
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Offline mode cannot start a new sign-in. Reconnect to Firebase,
                  then try again.
                </span>
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <label className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 px-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="developer@example.com"
                autoComplete={isResetMode ? 'email' : 'username'}
                maxLength={MAX_EMAIL_LENGTH}
                className="rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700/80 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-950 dark:focus:ring-blue-500/10"
                required
              />
            </div>

            {!isResetMode ? (
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 px-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    authMode === 'login' ? 'current-password' : 'new-password'
                  }
                  maxLength={MAX_PASSWORD_LENGTH}
                  className="rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700/80 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-950 dark:focus:ring-blue-500/10"
                  required
                />
                {authMode === 'signup' ? (
                  <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
                    At least {MIN_SIGNUP_PASSWORD_LENGTH} characters. Longer
                    passphrases are welcome.
                  </p>
                ) : null}
              </div>
            ) : null}

            {errorMessage ? (
              <p className="rounded-2xl border border-red-200 bg-red-50/80 backdrop-blur px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {errorMessage}
              </p>
            ) : null}

            {infoMessage ? (
              <p
                className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200"
                role="status"
              >
                {infoMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || isOffline}
              className="relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3.5 font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] shadow-md hover:shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-80 text-sm cursor-pointer"
            >
              {loading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : null}
              {authMode === 'login'
                ? 'Launch Workspace'
                : authMode === 'signup'
                  ? 'Create Account'
                  : 'Send reset instructions'}
            </button>
          </form>

          {!isResetMode ? (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                  or connect with
                </span>
                <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
              </div>

              <button
                type="button"
                disabled={loading || isOffline}
                onClick={handleGoogleLogin}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/40 px-4 py-3.5 font-semibold text-slate-700 transition-all hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-800 dark:text-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-900/80 text-sm cursor-pointer shadow-sm"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
            </>
          ) : null}

          <Link
            to="/receiver"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/15"
          >
            <QrCode className="h-4 w-4" />
            Receive an image offline
          </Link>

          <div className="mt-6 flex flex-col items-center gap-2">
            {!isResetMode ? (
              <button
                type="button"
                onClick={() => {
                  setAuthMode((current) =>
                    current === 'login' ? 'signup' : 'login',
                  )
                  setErrorMessage('')
                  setInfoMessage('')
                }}
                className="text-sm font-semibold text-blue-600 transition-all hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
              >
                {authMode === 'login'
                  ? 'New to ProMana? Register here'
                  : 'Already have an account? Sign in'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setAuthMode((current) =>
                  current === 'reset' ? 'login' : 'reset',
                )
                setErrorMessage('')
                setInfoMessage('')
              }}
              className="text-sm font-semibold text-slate-500 transition-all hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:underline"
            >
              {isResetMode ? 'Back to sign in' : 'Forgot your password?'}
            </button>
          </div>
        </div>

        <MadeByFooter className="mt-8 text-slate-400 dark:text-slate-500" />
      </div>
    </div>
  )
}
