import { useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { LoaderCircle } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import BackgroundColorControl from '../components/BackgroundColorControl'
import BrandMark from '../components/BrandMark'
import MadeByFooter from '../components/MadeByFooter'
import { auth, db } from '../firebase'
import useAuth from '../hooks/useAuth'
import useLightBackgroundColor from '../hooks/useLightBackgroundColor'
import reportAuthFailure from '../utils/authFailureReporter'
import fetchIpAddress from '../utils/ipFetcher'

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

function getAuthErrorMessage(error) {
  const code = error?.code ?? ''

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'The email or password is incorrect.'
  }

  if (code === 'auth/user-not-found') {
    return 'No account was found for that email.'
  }

  if (code === 'auth/email-already-in-use') {
    return 'That email is already registered.'
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was closed before it finished.'
  }

  if (code === 'auth/popup-blocked') {
    return 'The Google sign-in popup was blocked by the browser. Allow popups for this site and try again.'
  }

  if (code === 'auth/cancelled-popup-request') {
    return 'Another Google sign-in popup is already in progress. Close the extra popup and try again.'
  }

  if (code === 'auth/unauthorized-domain') {
    return 'This production domain is not authorized in Firebase Authentication yet. Add your deployed domain in Firebase Console -> Authentication -> Settings -> Authorized domains.'
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled for this Firebase project. Enable Google in Firebase Console -> Authentication -> Sign-in method.'
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'This email already exists with a different sign-in method. Sign in with the existing method first, then link Google if needed.'
  }

  if (code === 'auth/network-request-failed') {
    return 'The network request failed while contacting Firebase. Check your connection and try again.'
  }

  if (code === 'auth/weak-password') {
    return 'Choose a stronger password with at least 6 characters.'
  }

  return code
    ? `Authentication failed (${code}). Please try again.`
    : 'Authentication failed. Please try again.'
}

export default function LoginPage() {
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [darkMode] = useState(
    () => window.localStorage.getItem('proman-theme') === 'dark',
  )
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const {
    lightBackgroundColor,
    setLightBackgroundColor,
    resetLightBackgroundColor,
  } = useLightBackgroundColor()
  const googleProvider = useMemo(() => new GoogleAuthProvider(), [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  async function writeLoginLog({ uid, method, success, ipAddress }) {
    if (!uid) {
      return
    }

    try {
      await addDoc(collection(db, 'users', uid, 'loginLogs'), {
        timestamp: Timestamp.now(),
        method,
        success,
        userAgent: navigator.userAgent,
        ipAddress,
      })
    } catch {
      // Firestore logging is best-effort here to avoid interrupting auth.
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const method = authMode === 'login' ? 'email-password' : 'email-signup'

    try {
      const credentials =
        authMode === 'login'
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password)

      const ipAddress = await fetchIpAddress()

      await writeLoginLog({
        uid: credentials.user.uid,
        method,
        success: true,
        ipAddress,
      })

      navigate('/dashboard', { replace: true })
    } catch (error) {
      const ipAddress = await fetchIpAddress()

      await writeLoginLog({
        uid: auth.currentUser?.uid ?? null,
        method,
        success: false,
        ipAddress,
      })
      await reportAuthFailure({
        method,
        authMode,
        code: error?.code ?? null,
        message: error?.message ?? null,
        ipAddress,
        emailProvided: Boolean(email.trim()),
      })

      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setErrorMessage('')
    googleProvider.setCustomParameters({ prompt: 'select_account' })

    try {
      const credentials = await signInWithPopup(auth, googleProvider)
      const ipAddress = await fetchIpAddress()

      await writeLoginLog({
        uid: credentials.user.uid,
        method: 'google',
        success: true,
        ipAddress,
      })

      navigate('/dashboard', { replace: true })
    } catch (error) {
      const ipAddress = await fetchIpAddress()

      await writeLoginLog({
        uid: auth.currentUser?.uid ?? null,
        method: 'google',
        success: false,
        ipAddress,
      })
      await reportAuthFailure({
        method: 'google',
        authMode,
        code: error?.code ?? null,
        message: error?.message ?? null,
        ipAddress,
        emailProvided: false,
      })

      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
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
              {authMode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage your local environments, notes, and targets.
            </p>
          </div>

          <form className="grid gap-5" onSubmit={handleEmailSubmit}>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 px-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="developer@example.com"
                className="rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700/80 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-950 dark:focus:ring-blue-500/10"
                required
              />
              <p className="px-1 text-[11px] text-slate-400 dark:text-slate-500">
                demo credentials: user@gmail.com
              </p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 px-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700/80 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-950 dark:focus:ring-blue-500/10"
                required
              />
              <p className="px-1 text-[11px] text-slate-400 dark:text-slate-500">
                demo credentials: password
              </p>
            </div>

            {errorMessage ? (
              <p className="rounded-2xl border border-red-200 bg-red-50/80 backdrop-blur px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3.5 font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] shadow-md hover:shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-80 text-sm cursor-pointer"
            >
              {loading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : null}
              {authMode === 'login' ? 'Launch Workspace' : 'Create Account'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
              or connect with
            </span>
            <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/40 px-4 py-3.5 font-semibold text-slate-700 transition-all hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-800 dark:text-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-900/80 text-sm cursor-pointer shadow-sm"
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setAuthMode((current) => (current === 'login' ? 'signup' : 'login'))
                setErrorMessage('')
              }}
              className="text-sm font-semibold text-blue-600 transition-all hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
            >
              {authMode === 'login' ? 'New to ProMana? Register here' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <MadeByFooter className="mt-8 text-slate-400 dark:text-slate-500" />
      </div>
    </div>
  )
}
