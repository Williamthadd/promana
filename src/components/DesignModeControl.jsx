import { useEffect, useRef, useState } from 'react'
import { Building2, Check, LayoutDashboard, X } from 'lucide-react'

const DESIGN_OPTIONS = [
  {
    value: 'classic',
    label: 'Classic dashboard',
    description: 'Use the familiar workspace tabs and overview cards.',
    icon: LayoutDashboard,
  },
  {
    value: 'city',
    label: 'ProMana City',
    description: 'Navigate your work through an animated 3D city.',
    icon: Building2,
  },
]

export default function DesignModeControl({
  designMode = 'classic',
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)
  const ActiveIcon = designMode === 'city' ? Building2 : LayoutDashboard

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

  function selectDesignMode(nextMode) {
    onChange(nextMode)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white sm:h-11 sm:w-11"
        aria-label={`Change dashboard design. Current design: ${
          designMode === 'city' ? 'ProMana City' : 'Classic dashboard'
        }`}
        aria-expanded={isOpen}
        title="Change dashboard design"
      >
        <ActiveIcon className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {isOpen ? (
        <div className="fixed left-4 right-4 top-20 z-50 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Dashboard design
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Choose how you move between ProMana workspaces. Your choice is
                saved on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Close design picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {DESIGN_OPTIONS.map((option) => {
              const Icon = option.icon
              const isActive = option.value === designMode

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectDesignMode(option.value)}
                  className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    isActive
                      ? 'border-cyan-400/60 bg-cyan-50 text-slate-950 ring-2 ring-cyan-100 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-white dark:ring-cyan-400/10'
                      : 'border-gray-200 text-slate-700 hover:border-cyan-300 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:bg-slate-800'
                  }`}
                  aria-pressed={isActive}
                >
                  <span
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      isActive
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                        : 'bg-slate-100 text-slate-500 group-hover:text-cyan-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:text-cyan-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {option.description}
                    </span>
                  </span>
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      isActive
                        ? 'bg-cyan-600 text-white'
                        : 'border border-gray-200 text-transparent dark:border-slate-700'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
