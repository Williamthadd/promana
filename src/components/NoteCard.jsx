import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  Bookmark,
  Check,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  Maximize2,
  PencilLine,
  Trash2,
  X,
} from "lucide-react"
import ConfirmDialog from "./ConfirmDialog"
import {
  NOTE_TYPE_COLOR_CLASSES,
  NOTE_TYPE_PANEL_CLASSES,
  NOTE_TYPE_TEXT_COLOR_CLASSES,
  getNoteTypeLabel,
  normalizeNoteType,
  normalizeNoteVisibility,
} from "../constants/noteOptions"
import { formatRelativeTime } from "../utils/formatters"

const TAG_COLOR_CLASSES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
]

function getTagClass(tag) {
  const hash = [...tag].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return TAG_COLOR_CLASSES[hash % TAG_COLOR_CLASSES.length]
}

function getNoteTitle(note) {
  return note.title?.trim() || "Untitled note"
}

function LockedNoteContent({ expanded = false }) {
  return (
    <div
      className={`relative flex h-full flex-col items-center justify-center text-center ${
        expanded ? "min-h-full p-8" : "min-h-44 p-5"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(135deg,transparent,transparent_12px,rgba(255,255,255,0.12)_12px,rgba(255,255,255,0.12)_24px)]" />
      <p className="relative inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-sm">
        <EyeOff className="h-4 w-4" />
        Locked on this device
      </p>
      <p className="relative mt-3 max-w-sm text-xs font-medium leading-relaxed text-slate-300">
        This hidden note is encrypted and this device does not hold the key.
        Import your encryption key or open it where it was created.
      </p>
    </div>
  )
}

function HiddenNoteContent({ onReveal, expanded = false }) {
  return (
    <div
      className={`relative flex h-full flex-col items-center justify-center text-center ${
        expanded ? "min-h-full p-8" : "min-h-44 p-5"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(135deg,transparent,transparent_12px,rgba(255,255,255,0.12)_12px,rgba(255,255,255,0.12)_24px)]" />
      <button
        type="button"
        onClick={onReveal}
        className="relative inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/15"
      >
        <Eye className="h-4 w-4" />
        Reveal note content
      </button>
      <p className="relative mt-3 max-w-sm text-xs font-medium leading-relaxed text-slate-300">
        This note is hidden by default. Reveal it when you are ready to read it.
      </p>
    </div>
  )
}

function ExpandedNoteView({
  note,
  lineCount,
  typeClass,
  panelClass,
  contentTextClass,
  isTextLike,
  isContentVisible,
  isLocked,
  onClose,
  onCopy,
  onToggleContent,
  onSaveContent,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const canEdit = typeof onSaveContent === "function" && !isLocked

  function startEditing() {
    if (!isContentVisible) {
      onToggleContent()
    }
    setEditDraft(note.content ?? "")
    setIsEditing(true)
  }

  function cancelEditing() {
    setEditDraft("")
    setIsEditing(false)
  }

  async function saveEditing() {
    if (isSaving) {
      return
    }

    setIsSaving(true)

    try {
      const didSave = await onSaveContent(editDraft)

      if (didSave) {
        setIsEditing(false)
        setEditDraft("")
      }
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (isEditing) {
          cancelEditing()
        } else {
          onClose()
        }
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, isEditing])

  if (typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div
      className="calendar-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-md sm:p-4"
      onClick={onClose}
    >
      <section
        className="calendar-modal-panel flex h-[calc(100dvh-1rem)] w-full max-w-[90rem] flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-slate-950/95 sm:h-[calc(100dvh-2rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expanded-note-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 p-4 dark:border-white/10 sm:p-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typeClass}`}
              >
                {getNoteTypeLabel(note.type)}
              </span>
              {normalizeNoteVisibility(note.visibility) === "hidden" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <EyeOff className="h-3.5 w-3.5" />
                  Hidden by default
                </span>
              ) : null}
            </div>
            <h2
              id="expanded-note-title"
              className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl"
            >
              {getNoteTitle(note)}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Updated {formatRelativeTime(note.lastUpdatedAt)} · {lineCount} line
              {lineCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveEditing()}
                  disabled={isSaving || !editDraft.trim()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isSaving ? "Saving…" : "Save"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onToggleContent}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-200"
                  aria-label={isContentVisible ? "Hide note content" : "Reveal note content"}
                >
                  {isContentVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isContentVisible ? "Hide" : "Reveal"}
                  </span>
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                    aria-label="Edit note content"
                  >
                    <PencilLine className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onCopy}
                  disabled={!isContentVisible}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close expanded note"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!!note.tags?.length && (
            <div className="flex w-full flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getTagClass(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 p-3 sm:p-5">
          <div
            className={`relative flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${panelClass}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)]" />
            {isEditing ? (
              <div className="relative flex min-h-0 flex-1 flex-col p-5 sm:p-8">
                <textarea
                  autoFocus
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault()
                      void saveEditing()
                    }
                  }}
                  className={`min-h-0 flex-1 resize-none rounded-xl border border-white/20 bg-black/30 p-4 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 ${contentTextClass} ${
                    isTextLike
                      ? "font-sans text-base leading-8"
                      : "font-mono text-sm leading-7 sm:text-[15px]"
                  }`}
                  placeholder="Write the note content…"
                />
                <p className="mt-3 text-xs font-medium text-slate-400">
                  Press ⌘/Ctrl + Enter to save, or Esc to cancel.
                </p>
              </div>
            ) : isLocked ? (
              <div className="relative h-full overflow-auto">
                <LockedNoteContent expanded />
              </div>
            ) : isContentVisible ? (
              <div className="relative h-full overflow-auto">
                <pre
                  className={`relative min-h-full whitespace-pre-wrap break-words p-5 sm:p-8 ${contentTextClass} ${
                    isTextLike
                      ? "font-sans text-base leading-8"
                      : "font-mono text-sm leading-7 sm:text-[15px]"
                  }`}
                >
                  <code>{note.content?.trim() || "No note content yet."}</code>
                </pre>
              </div>
            ) : (
              <div className="relative h-full overflow-auto">
                <HiddenNoteContent onReveal={onToggleContent} expanded />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}

export default function NoteCard({
  note,
  onDelete,
  onEdit,
  onSaveContent,
  onTogglePin,
  onTagClick,
  addToast,
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const defaultVisibility = normalizeNoteVisibility(note.visibility)
  const visibilityKey = `${note.id}:${defaultVisibility}`
  const [visibilityOverride, setVisibilityOverride] = useState(null)
  const isLocked = Boolean(note.contentLocked)
  const isContentVisible =
    !isLocked &&
    (visibilityOverride?.key === visibilityKey
      ? visibilityOverride.isVisible
      : defaultVisibility !== "hidden")
  const normalizedType = normalizeNoteType(note.type)
  const typeClass =
    NOTE_TYPE_COLOR_CLASSES[normalizedType] ?? NOTE_TYPE_COLOR_CLASSES.text
  const panelClass =
    NOTE_TYPE_PANEL_CLASSES[normalizedType] ?? NOTE_TYPE_PANEL_CLASSES.text
  const contentTextClass =
    NOTE_TYPE_TEXT_COLOR_CLASSES[normalizedType] ??
    NOTE_TYPE_TEXT_COLOR_CLASSES.text
  const isTextLike = normalizedType === "text" || normalizedType === "reference"
  const lineCount = useMemo(
    () => String(note.content ?? "").split(/\r\n|\r|\n/).length,
    [note.content],
  )

  function updateContentVisibility(nextValue) {
    setVisibilityOverride((currentOverride) => {
      const currentValue =
        currentOverride?.key === visibilityKey
          ? currentOverride.isVisible
          : defaultVisibility !== "hidden"

      return {
        key: visibilityKey,
        isVisible:
          typeof nextValue === "function" ? nextValue(currentValue) : nextValue,
      }
    })
  }

  function handleLockedAction() {
    addToast(
      "This hidden note is locked on this device. Import your encryption key or open it where it was created.",
      "info",
    )
  }

  async function handleCopy() {
    if (isLocked) {
      handleLockedAction()
      return
    }

    if (!isContentVisible) {
      addToast("Reveal the note before copying its content.", "info")
      return
    }

    const nextContent = String(note.content ?? "")

    if (!nextContent.trim()) {
      addToast("There is no note content to copy yet.", "info")
      return
    }

    try {
      await navigator.clipboard.writeText(nextContent)
      addToast("Note content copied.", "success")
    } catch {
      addToast("Unable to copy the note content right now.", "error")
    }
  }

  return (
    <>
      <article className="flex h-full flex-col gap-5 rounded-3xl p-6 transition-all duration-300 glass-panel-light dark:glass-panel-dark shadow-md hover:shadow-xl hover:-translate-y-1 hover:scale-[1.015] border border-white/50 dark:border-white/10 hover:border-blue-500/30 dark:hover:border-blue-400/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typeClass}`}
            >
              {getNoteTypeLabel(normalizedType)}
            </span>
            {defaultVisibility === "hidden" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <EyeOff className="h-3.5 w-3.5" />
                Hidden
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void onTogglePin?.(note)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label={note.isPinned ? "Unpin note" : "Pin note"}
            >
              <Bookmark
                className="h-4.5 w-4.5"
                fill={note.isPinned ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLocked) {
                  handleLockedAction()
                  return
                }
                updateContentVisibility((currentValue) => !currentValue)
              }}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                isContentVisible
                  ? "border-gray-200 text-slate-500 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-200"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
              }`}
              aria-label={isContentVisible ? "Hide note content" : "Reveal note content"}
              title={isContentVisible ? "Hide note content" : "Reveal note content"}
            >
              {isContentVisible ? (
                <EyeOff className="h-4.5 w-4.5" />
              ) : (
                <Eye className="h-4.5 w-4.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-200"
              aria-label="Expand note"
              title="Open note in full view"
            >
              <Maximize2 className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!isContentVisible}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label="Copy note content"
            >
              <Copy className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(note)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label="Edit note"
            >
              <PencilLine className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-200"
              aria-label="Delete note"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <div>
          <h3 className="line-clamp-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {getNoteTitle(note)}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {isLocked
              ? `Updated ${formatRelativeTime(note.lastUpdatedAt)} · Locked on this device`
              : `Updated ${formatRelativeTime(note.lastUpdatedAt)} · ${lineCount} line${lineCount === 1 ? "" : "s"}`}
          </p>
        </div>

        {!!note.tags?.length && (
          <div className="flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-85 ${getTagClass(tag)}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div
          className={`relative flex-1 overflow-hidden rounded-3xl bg-gradient-to-br ${panelClass} p-4`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)]" />
          <div className="relative">
            {isLocked ? (
              <LockedNoteContent />
            ) : isContentVisible ? (
              <pre
                className={`max-h-72 overflow-auto whitespace-pre-wrap break-words ${contentTextClass} ${
                  isTextLike
                    ? "font-sans text-sm leading-6"
                    : "font-mono text-sm leading-6"
                }`}
              >
                <code>{note.content?.trim() || "No note content yet."}</code>
              </pre>
            ) : (
              <HiddenNoteContent onReveal={() => updateContentVisibility(true)} />
            )}
          </div>
        </div>
      </article>

      {isExpanded ? (
        <ExpandedNoteView
          note={note}
          lineCount={lineCount}
          typeClass={typeClass}
          panelClass={panelClass}
          contentTextClass={contentTextClass}
          isTextLike={isTextLike}
          isContentVisible={isContentVisible}
          isLocked={isLocked}
          onClose={() => setIsExpanded(false)}
          onCopy={handleCopy}
          onToggleContent={() => {
            if (isLocked) {
              handleLockedAction()
              return
            }
            updateContentVisibility((currentValue) => !currentValue)
          }}
          onSaveContent={
            onSaveContent ? (content) => onSaveContent(note, content) : undefined
          }
        />
      ) : null}

      <ConfirmDialog
        open={isConfirmOpen}
        title="Remove note?"
        message={`Are you sure you want to remove ${getNoteTitle(note)} from Notes?`}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false)
          void onDelete?.(note)
        }}
      />
    </>
  )
}
