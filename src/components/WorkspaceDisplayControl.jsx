import { useEffect, useRef, useState } from 'react'
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import {
  DEFAULT_WORKSPACE_BOX_SIZE,
  DEFAULT_WORKSPACE_TEXT_SIZE,
  WORKSPACE_SIZE_MAX,
  WORKSPACE_SIZE_MIN,
  getWorkspaceSizeLabel,
} from '../utils/workspaceDisplay'

function SizeSlider({ id, label, hint, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm font-semibold text-slate-900 dark:text-white"
        >
          {label}
        </label>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {getWorkspaceSizeLabel(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={WORKSPACE_SIZE_MIN}
        max={WORKSPACE_SIZE_MAX}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full cursor-pointer accent-blue-600 dark:accent-blue-500"
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500">
        <span>{hint[0]}</span>
        <span>{hint[1]}</span>
      </div>
    </div>
  )
}

export default function WorkspaceDisplayControl({
  boxSize,
  textSize,
  onChangeBoxSize,
  onChangeTextSize,
  onReset,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)
  const isDefault =
    boxSize === DEFAULT_WORKSPACE_BOX_SIZE &&
    textSize === DEFAULT_WORKSPACE_TEXT_SIZE

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
        aria-label="Adjust workspace card and text size"
        title="Adjust workspace card and text size"
        aria-expanded={isOpen}
      >
        <SlidersHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {isOpen ? (
        <div className="fixed left-4 right-4 top-20 z-50 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-80 sm:fixed-none dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Workspace Size
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Tune how big the cards and text are in Projects, Launchpad,
                Notes, and Tasks. Larger boxes show fewer cards per row.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Close workspace size settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-6">
            <SizeSlider
              id="workspace-box-size"
              label="Box size"
              hint={['More, smaller', 'Fewer, larger']}
              value={boxSize}
              onChange={onChangeBoxSize}
            />
            <SizeSlider
              id="workspace-text-size"
              label="Text size"
              hint={['Smaller text', 'Larger text']}
              value={textSize}
              onChange={onChangeTextSize}
            />
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={onReset}
              disabled={isDefault}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to default
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
