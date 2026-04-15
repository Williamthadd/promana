import { useMemo, useState } from "react"
import { Bookmark, Copy, PencilLine, StickyNote, Trash2 } from "lucide-react"
import ConfirmDialog from "./ConfirmDialog"
import {
  NOTE_CODE_PANEL_CLASSES,
  NOTE_TYPE_COLOR_CLASSES,
  getNoteTypeLabel,
  normalizeNoteLanguage,
  normalizeNoteType,
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

export default function NoteCard({
  note,
  onDelete,
  onEdit,
  onTogglePin,
  onTagClick,
  addToast,
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const normalizedType = normalizeNoteType(note.type)
  const normalizedLanguage = normalizeNoteLanguage(note.language)
  const typeClass =
    NOTE_TYPE_COLOR_CLASSES[normalizedType] ?? NOTE_TYPE_COLOR_CLASSES.text
  const panelClass =
    NOTE_CODE_PANEL_CLASSES[normalizedLanguage] ??
    NOTE_CODE_PANEL_CLASSES.plaintext
  const isTextLike = normalizedType === "text" || normalizedLanguage === "markdown"
  const lineCount = useMemo(
    () => String(note.content ?? "").split(/\r\n|\r|\n/).length,
    [note.content],
  )

  async function handleCopy() {
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
      <article className="flex h-full flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typeClass}`}
            >
              {getNoteTypeLabel(normalizedType)}
            </span>
          </div>

          <div className="flex items-center gap-2">
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
              onClick={handleCopy}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
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
            Updated {formatRelativeTime(note.lastUpdatedAt)} · {lineCount} line
            {lineCount === 1 ? "" : "s"}
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
          className={`relative flex-1 overflow-hidden rounded-3xl bg-gradient-to-br ${panelClass} p-4 text-slate-100`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)]" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
              <StickyNote className="h-3.5 w-3.5" />
              {normalizedLanguage}
            </div>

            <pre
              className={`max-h-72 overflow-auto whitespace-pre-wrap break-words ${
                isTextLike ? "font-sans text-sm leading-6" : "font-mono text-sm leading-6"
              }`}
            >
              <code>{note.content?.trim() || "No note content yet."}</code>
            </pre>
          </div>
        </div>
      </article>

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
