import { useState } from "react"
import { createPortal } from "react-dom"
import { LoaderCircle, Tags, X } from "lucide-react"
import {
  NOTE_TYPE_OPTIONS,
  normalizeNoteLanguage,
  normalizeNoteType,
} from "../constants/noteOptions"

function getDefaultDraft(note) {
  return {
    title: note?.title ?? "",
    type: normalizeNoteType(note?.type),
    language: normalizeNoteLanguage(note?.language),
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

function getNotePlaceholder(type, language) {
  if (type === "query" || language === "sql") {
    return "SELECT id, email\nFROM users\nWHERE active = true\nORDER BY created_at DESC;"
  }

  if (type === "config" || language === "yaml") {
    return "app:\n  name: ProMan\n  environment: production"
  }

  if (language === "golang") {
    return "func main() {\n    fmt.Println(\"hello from ProMan\")\n}"
  }

  if (language === "python") {
    return "def greet(name):\n    return f\"Hello, {name}\""
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
      language: normalizeNoteLanguage(draft.language),
      tags: parseTags(draft.tagsText),
      content: draft.content,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Notes workspace
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isEditing ? "Edit note card" : "Add a new note card"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Save code snippets, SQL queries, config blocks, and plain text notes
              in one clean workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close note modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Card title
              </span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder="Optional, for example User seed query"
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Note type
              </span>
              <select
                value={draft.type}
                onChange={(event) => updateDraft("type", event.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
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
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Tags
              </span>
              <div className="relative">
                <Tags className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={draft.tagsText}
                  onChange={(event) => updateDraft("tagsText", event.target.value)}
                  placeholder="backend, sql, production"
                  className="w-full rounded-2xl border border-gray-200 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Separate tags with commas so you can filter related notes later.
              </p>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Content
            </span>
            <textarea
              value={draft.content}
              onChange={(event) => updateDraft("content", event.target.value)}
              placeholder={getNotePlaceholder(draft.type, draft.language)}
              rows={14}
              className="min-h-72 rounded-3xl border border-gray-200 px-4 py-4 font-mono text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
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
