import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Moon, Sun, X } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import BrandMark from './BrandMark'
import UserAvatar from './UserAvatar'

export default function Header({ user, darkMode, onToggleDark, addToast }) {
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
      await signOut(auth)
      setIsOpen(false)
      navigate('/login', { replace: true })
      addToast?.('You have been logged out.', 'info')
    } catch {
      addToast?.('Unable to log out right now.', 'error')
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-blue-200/60 bg-[#BFDBFE]/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        
        {/* Logo */}
        <Link to="/dashboard" className="inline-flex items-center">
          <BrandMark
            logoClassName="h-8 w-8 sm:h-10 sm:w-10 rounded-2xl object-cover shadow-sm"
            titleClassName="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={onToggleDark}
            className="inline-flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/70 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              className="flex items-center gap-2 sm:gap-3 rounded-full border border-white/70 bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-left shadow-sm transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <UserAvatar
                user={user}
                imageClassName="h-7 w-7 sm:h-10 sm:w-10 rounded-full object-cover"
                fallbackClassName="inline-flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-slate-800 dark:text-blue-200"
                iconClassName="h-4 w-4 sm:h-5 sm:w-5"
              />

              {/* Email — hidden on mobile, visible on sm+ */}
              <span className="hidden sm:block min-w-0 flex-1 max-w-[12rem]">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {user?.email ?? 'Signed in user'}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Account
                </span>
              </span>

              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            </button>

            {/* Dropdown panel */}
            {isOpen && (
              <div className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-xs sm:w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={user}
                    imageClassName="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover"
                    fallbackClassName="inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-slate-800 dark:text-blue-200"
                    iconClassName="h-5 w-5 sm:h-6 sm:w-6"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.email ?? 'Signed in user'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {user?.uid ? `User ID: ${user.uid.slice(0, 10)}...` : 'Firebase account'}
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
            )}
          </div>
        </div>
      </div>
    </header>
  )
}