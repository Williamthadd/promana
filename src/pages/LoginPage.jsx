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
import BrandMark from '../components/BrandMark'
import { auth, db } from '../firebase'
import useAuth from '../hooks/useAuth'
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
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const googleProvider = useMemo(() => new GoogleAuthProvider(), [])

  useEffect(() => {
    const isDarkMode = window.localStorage.getItem('proman-theme') === 'dark'
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [])

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
      <div className="flex min-h-screen items-center justify-center bg-[#BFDBFE] dark:bg-slate-950">
        <LoaderCircle className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-300" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#BFDBFE] px-4 py-12 dark:bg-slate-950">
      <div className="absolute -left-24 top-8 h-64 w-64 rounded-full bg-white/40 blur-3xl dark:bg-blue-500/10" />
      <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-blue-300/40 blur-3xl dark:bg-cyan-500/10" />

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col items-center justify-center">
        <BrandMark
          className="mb-6"
          logoClassName="h-20 w-20 rounded-[1.75rem] object-cover shadow-xl ring-1 ring-black/5 dark:ring-white/10"
          titleClassName="text-4xl font-black tracking-tight text-slate-900 dark:text-white"
        />

        <div className="w-full rounded-2xl border border-gray-100 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Local project launcher
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {authMode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
          </div>

          <form className="grid gap-4" onSubmit={handleEmailSubmit}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              required
            />

            {errorMessage ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
            >
              {loading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : null}
              {authMode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              or
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <GoogleIcon />
            Google login
          </button>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setAuthMode((current) => (current === 'login' ? 'signup' : 'login'))
                setErrorMessage('')
              }}
              className="text-sm font-medium text-blue-700 transition hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {authMode === 'login' ? 'Sign up......' : 'Back to login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
