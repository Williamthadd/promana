import { useMemo } from "react"
import { SearchX } from "lucide-react"
import NoteCard from "./NoteCard"
import NoteSkeletonCard from "./NoteSkeletonCard"

export default function NotesGrid({
  notes,
  loading,
  searchQuery,
  filterType,
  filterLanguage,
  filterTag,
  onDelete,
  onEdit,
  onTogglePin,
  onTagClick,
  addToast,
}) {
  const visibleNotes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const normalizedType = filterType.trim().toLowerCase()
    const normalizedLanguage = filterLanguage.trim().toLowerCase()
    const normalizedTag = filterTag.trim().toLowerCase()

    return notes.filter((note) => {
      const matchesType =
        !normalizedType ||
        normalizedType === "all" ||
        (note.type ?? "").toLowerCase() === normalizedType

      const matchesLanguage =
        !normalizedLanguage ||
        normalizedLanguage === "all" ||
        (note.language ?? "").toLowerCase() === normalizedLanguage

      const matchesTag =
        !normalizedTag ||
        normalizedTag === "all" ||
        (note.tags ?? []).some((tag) => tag.toLowerCase() === normalizedTag)

      const matchesSearch =
        !normalizedSearch ||
        note.title?.toLowerCase().includes(normalizedSearch) ||
        note.content?.toLowerCase().includes(normalizedSearch) ||
        note.type?.toLowerCase().includes(normalizedSearch) ||
        note.language?.toLowerCase().includes(normalizedSearch) ||
        (note.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedSearch))

      return matchesType && matchesLanguage && matchesTag && matchesSearch
    })
  }, [filterLanguage, filterTag, filterType, notes, searchQuery])

  const pinnedNotes = visibleNotes.filter((note) => note.isPinned)
  const regularNotes = visibleNotes.filter((note) => !note.isPinned)

  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <NoteSkeletonCard key={`note-skeleton-${index}`} />
        ))}
      </section>
    )
  }

  if (!notes.length) {
    return (
      <section className="rounded-2xl border border-dashed border-blue-200 bg-white p-8 text-center shadow-sm dark:border-blue-500/20 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-3xl dark:bg-blue-500/10">
          📝
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          No notes yet
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Save your first code snippet, SQL query, config block, or quick text
          note above.
        </p>
      </section>
    )
  }

  if (!visibleNotes.length) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SearchX className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
        <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
          No notes match your search.
        </p>
      </section>
    )
  }

  return (
    <div className="grid gap-6">
      {pinnedNotes.length ? (
        <section className="grid gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            📌 Pinned
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onDelete={onDelete}
                onEdit={onEdit}
                onTogglePin={onTogglePin}
                onTagClick={onTagClick}
                addToast={addToast}
              />
            ))}
          </div>
        </section>
      ) : null}

      {regularNotes.length ? (
        <section className="grid gap-3">
          {pinnedNotes.length ? (
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              All notes
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regularNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onDelete={onDelete}
                onEdit={onEdit}
                onTogglePin={onTogglePin}
                onTagClick={onTagClick}
                addToast={addToast}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
