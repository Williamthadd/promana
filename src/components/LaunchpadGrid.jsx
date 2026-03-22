import { useMemo } from 'react'
import { SearchX } from 'lucide-react'
import { getDomainFromUrl } from '../utils/faviconUtils'
import LaunchpadCard from './LaunchpadCard'
import LaunchpadSkeletonCard from './LaunchpadSkeletonCard'

export default function LaunchpadGrid({
  items,
  loading,
  searchQuery,
  filterCategory,
  onDelete,
  onUpdate,
  onTogglePin,
  addToast,
}) {
  const visibleItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const normalizedCategory = filterCategory.trim().toLowerCase()

    return items.filter((item) => {
      const matchesCategory =
        !normalizedCategory ||
        normalizedCategory === 'all' ||
        (item.category ?? '').toLowerCase() === normalizedCategory

      const matchesSearch =
        !normalizedSearch ||
        item.name?.toLowerCase().includes(normalizedSearch) ||
        getDomainFromUrl(item.url).toLowerCase().includes(normalizedSearch) ||
        item.category?.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [filterCategory, items, searchQuery])

  const pinnedItems = visibleItems.filter((item) => item.isPinned)
  const regularItems = visibleItems.filter((item) => !item.isPinned)

  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <LaunchpadSkeletonCard key={`launchpad-skeleton-${index}`} />
        ))}
      </section>
    )
  }

  if (!items.length) {
    return (
      <section className="rounded-2xl border border-dashed border-blue-200 bg-white p-8 text-center shadow-sm dark:border-blue-500/20 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-3xl dark:bg-blue-500/10">
          🌐
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          No shortcuts yet
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Add your first web platform above.
        </p>
      </section>
    )
  }

  if (!visibleItems.length) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SearchX className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
        <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
          No shortcuts match your search.
        </p>
      </section>
    )
  }

  return (
    <div className="grid gap-6">
      {pinnedItems.length ? (
        <section className="grid gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            📌 Pinned
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedItems.map((item) => (
              <LaunchpadCard
                key={item.id}
                item={item}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onTogglePin={onTogglePin}
                addToast={addToast}
              />
            ))}
          </div>
        </section>
      ) : null}

      {regularItems.length ? (
        <section className="grid gap-3">
          {pinnedItems.length ? (
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              All shortcuts
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regularItems.map((item) => (
              <LaunchpadCard
                key={item.id}
                item={item}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onTogglePin={onTogglePin}
                addToast={addToast}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}