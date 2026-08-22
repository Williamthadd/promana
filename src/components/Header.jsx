import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Moon, Sun, X } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { clearCachedOfflineImages } from '../features/offline-transfer/offlineImageCache'
import { toBackgroundRgba } from '../utils/lightBackground'
import { clearGoogleDriveAccessToken } from '../utils/googleDriveAuth'
import BackgroundColorControl from './BackgroundColorControl'
import BrandMark from './BrandMark'
import DesignModeControl from './DesignModeControl'
import UserAvatar from './UserAvatar'

export default function Header({
  user,
  darkMode,
  onToggleDark,
  addToast,
  lightBackgroundColor,
  onChangeLightBackgroundColor,
  onResetLightBackgroundColor,
  designMode,
  onChangeDesignMode,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen])

  async function handleLogout() {
    try {
      const uid = auth.currentUser?.uid
      clearGoogleDriveAccessToken(uid)
      if (uid) {
        await clearCachedOfflineImages(uid).catch(() => {
          addToast?.(
            'Browser storage could not confirm offline-image cleanup.',
            'info',
          )
        })
      }
      await signOut(auth)
      setIsOpen(false)
      navigate('/login', { replace: true })
      addToast?.('You have been logged out.', 'info')
    } catch {
      addToast?.('Unable to log out right now.', 'error')
    }
  }

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/20 dark:border-white/5 backdrop-blur-md shadow-sm bg-white/40 dark:bg-slate-950/40"
      style={
        darkMode
          ? undefined
          : { backgroundColor: toBackgroundRgba(lightBackgroundColor, 0.4) }
      }
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <Link to="/dashboard" className="inline-flex items-center">
          <BrandMark
            logoClassName="h-10 w-10 sm:h-15 sm:w-15 hover:scale-105 transition-transform"
            titleClassName="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <BackgroundColorControl
            darkMode={darkMode}
            lightBackgroundColor={lightBackgroundColor}
            onChange={onChangeLightBackgroundColor}
            onReset={onResetLightBackgroundColor}
          />

          <DesignModeControl
            designMode={designMode}
            onChange={onChangeDesignMode}
          />

          <button
            type="button"
            onClick={onToggleDark}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.02] hover:text-slate-950 dark:text-slate-200 dark:hover:text-white sm:h-11 sm:w-11"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              className="flex items-center gap-2 px-2 py-1.5 text-left shadow-sm transition hover:-translate-y-0.5 sm:gap-3 sm:px-3 sm:py-2 rounded-full border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark"
            >
              <UserAvatar
                user={user}
                imageClassName="h-7 w-7 rounded-full object-cover sm:h-10 sm:w-10"
                fallbackClassName="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-slate-800 dark:text-blue-200 sm:h-10 sm:w-10"
                iconClassName="h-4 w-4 sm:h-5 sm:w-5"
              />

              <span className="hidden min-w-0 max-w-[12rem] flex-1 sm:block">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {user?.email ?? 'Signed in user'}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Account
                </span>
              </span>

              <ChevronDown className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400 sm:h-4 sm:w-4" />
            </button>

            {isOpen ? (
              <div className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-xs rounded-2xl border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark p-4 shadow-xl sm:w-72">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={user}
                    imageClassName="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14"
                    fallbackClassName="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-slate-800 dark:text-blue-200 sm:h-14 sm:w-14"
                    iconClassName="h-5 w-5 sm:h-6 sm:w-6"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.email ?? 'Signed in user'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Signed in securely
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
