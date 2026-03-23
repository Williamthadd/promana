import { useEffect, useRef, useState } from 'react'
import { Palette, RotateCcw, X } from 'lucide-react'
import { DEFAULT_LIGHT_BACKGROUND_COLOR } from '../utils/lightBackground'

export default function BackgroundColorControl({
  darkMode = false,
  lightBackgroundColor,
  onChange,
  onReset,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)
  const isDefaultColor =
    lightBackgroundColor === DEFAULT_LIGHT_BACKGROUND_COLOR

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white sm:h-11 sm:w-11"
        aria-label="Customize light mode background color"
        title="Customize light mode background color"
      >
        <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {isOpen ? (
        <div className="fixed left-4 right-4 top-20 z-50 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-80 sm:fixed-none dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Light Background
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Pick a custom background for light mode. Dark mode keeps the
                current dark theme unchanged.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Close background color picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="color"
              value={lightBackgroundColor}
              onChange={(event) => onChange(event.target.value)}
              className="h-12 w-12 shrink-0 cursor-pointer rounded-xl border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
              aria-label="Choose a light mode background color"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {lightBackgroundColor}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {darkMode
                  ? 'Saved now and applied the next time you switch back to light mode.'
                  : 'Applied immediately across the light-mode pages.'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={onReset}
              disabled={isDefaultColor}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to {DEFAULT_LIGHT_BACKGROUND_COLOR}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}