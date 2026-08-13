import { useState } from "react"
import { createPortal } from "react-dom"
import { LoaderCircle, Tags, X } from "lucide-react"
import { NOTE_TYPE_OPTIONS, normalizeNoteType } from "../constants/noteOptions"

function getDefaultDraft(note) {
  return {
    title: note?.title ?? "",
    type: normalizeNoteType(note?.type),
    tagsText: (note?.tags ?? []).join(", "),
    content: note?.content ?? "",
  }
}

function parseTags(value) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}

function getNotePlaceholder(type) {
  if (type === "query") {
    return "SELECT id, email\nFROM users\nWHERE active = true\nORDER BY created_at DESC;"
  }

  if (type === "config") {
    return "app:\n  name: ProMana\n  environment: production"
  }

  return "Paste your snippet, text note, config block, or reference here..."
}

function NoteModalForm({ note, onClose, onSubmit, isSaving }) {
  const [draft, setDraft] = useState(() => getDefaultDraft(note))
  const isEditing = Boolean(note?.id)

  function updateDraft(name, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [name]: value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    void onSubmit?.({
      title: draft.title.trim(),
      type: normalizeNoteType(draft.type),
      tags: parseTags(draft.tagsText),
      content: draft.content,
    })
  }

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Notes workspace
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {isEditing ? "Edit note card" : "Add a new note card"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed font-medium text-slate-600 dark:text-slate-300">
              Save code snippets, SQL queries, config blocks, and plain text notes
              in one clean workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close note modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Card title
                </span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder="Optional, for example User seed query"
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Note type
                </span>
                <select
                  value={draft.type}
                  onChange={(event) => updateDraft("type", event.target.value)}
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20 cursor-pointer"
                >
                  {NOTE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Tags
                </span>
                <div className="relative">
                  <Tags className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={draft.tagsText}
                    onChange={(event) => updateDraft("tagsText", event.target.value)}
                    placeholder="backend, sql, production"
                    className="w-full rounded-2xl border border-white/40 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  />
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Separate tags with commas so you can filter related notes later.
                </p>
              </label>
            </div>

            <label className="grid gap-2 pb-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Content
              </span>
              <textarea
                value={draft.content}
                onChange={(event) => updateDraft("content", event.target.value)}
                placeholder={getNotePlaceholder(draft.type)}
                rows={16}
                className="min-h-[clamp(18rem,50vh,34rem)] w-full resize-y rounded-3xl border border-white/40 bg-white/80 px-5 py-5 font-mono text-sm leading-relaxed text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
            </label>
          </div>

          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/40 px-4 py-3 text-sm font-bold text-slate-700 bg-white/80 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:bg-slate-950/80 dark:hover:bg-slate-950 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 cursor-pointer"
            >
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isSaving
                ? isEditing
                  ? "Saving note..."
                  : "Adding note..."
                : isEditing
                  ? "Save note"
                  : "Add note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NoteModal({
  note,
  open,
  onClose,
  onSubmit,
  isSaving = false,
}) {
  if (!open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <NoteModalForm
      key={note?.id ?? "new-note"}
      note={note}
      onClose={onClose}
      onSubmit={onSubmit}
      isSaving={isSaving}
    />,
    document.body,
  )
}
