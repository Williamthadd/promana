import { useMemo, useState } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FolderKanban,
  Globe2,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  CALENDAR_WEEKDAYS,
  filterCalendarEntries,
  formatCalendarDate,
  formatCalendarMonth,
  formatCalendarTime,
  formatDateKey,
  getCalendarMonthDays,
  isTodayDateKey,
  shiftCalendarMonth,
} from '../utils/calendar'

function createLookup(items) {
  return new Map(items.map((item) => [item.id, item]))
}

function EntryLinks({
  entry,
  projectLookup,
  launchpadLookup,
  taskGroupLookup,
  onOpenProject,
  onOpenTaskGroup,
}) {
  const linkedProjects = entry.projectIds
    .map((id) => projectLookup.get(id))
    .filter(Boolean)
  const linkedLaunchpadItems = entry.launchpadItemIds
    .map((id) => launchpadLookup.get(id))
    .filter(Boolean)
  const linkedTaskGroups = entry.taskGroupIds
    .map((id) => taskGroupLookup.get(id))
    .filter(Boolean)

  if (
    linkedProjects.length === 0 &&
    linkedLaunchpadItems.length === 0 &&
    linkedTaskGroups.length === 0
  ) {
    return null
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {linkedProjects.map((project) => (
        <button
          key={project.id}
          type="button"
          onClick={() => onOpenProject?.(project)}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
          title="Open this project in Projects workspace"
        >
          <FolderKanban className="h-3.5 w-3.5" />
          {project.displayName || 'Project'}
        </button>
      ))}

      {linkedLaunchpadItems.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
        >
          <Globe2 className="h-3.5 w-3.5" />
          {item.name || 'Launchpad'}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}

      {linkedTaskGroups.map((taskGroup) => {
        const completeCount = taskGroup.tasks.filter(
          (task) => task.status === 'done',
        ).length

        return (
          <button
            key={taskGroup.id}
            type="button"
            onClick={() => onOpenTaskGroup?.(taskGroup)}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/70"
            title="Open this group in Tasks workspace"
          >
            <ListTodo className="h-3.5 w-3.5" />
            {taskGroup.title || 'Task group'}
            <span className="font-medium opacity-70">
              {completeCount}/{taskGroup.tasks.length}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function CalendarWorkspace({
  entries,
  loading,
  projects,
  launchpadItems,
  taskGroups,
  hasReachedLimit = false,
  onCreate,
  onEdit,
  onDelete,
  onOpenProject,
  onOpenTaskGroup,
}) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    formatDateKey(today),
  )
  const [scheduleSearch, setScheduleSearch] = useState({
    title: '',
    dateTimeFrom: '',
    dateTimeTo: '',
  })

  const monthDays = useMemo(() => getCalendarMonthDays(viewDate), [viewDate])
  const entriesByDate = useMemo(() => {
    const nextEntriesByDate = new Map()

    entries.forEach((entry) => {
      const dateEntries = nextEntriesByDate.get(entry.dateKey) ?? []
      dateEntries.push(entry)
      nextEntriesByDate.set(entry.dateKey, dateEntries)
    })

    return nextEntriesByDate
  }, [entries])
  const projectLookup = useMemo(() => createLookup(projects), [projects])
  const launchpadLookup = useMemo(
    () => createLookup(launchpadItems),
    [launchpadItems],
  )
  const taskGroupLookup = useMemo(
    () => createLookup(taskGroups),
    [taskGroups],
  )
  const selectedEntries = useMemo(
    () => entriesByDate.get(selectedDateKey) ?? [],
    [entriesByDate, selectedDateKey],
  )
  const isScheduleSearchActive = Object.values(scheduleSearch).some((value) =>
    value.trim(),
  )
  const displayedEntries = useMemo(() => {
    if (!isScheduleSearchActive) {
      return selectedEntries
    }

    return filterCalendarEntries(entries, scheduleSearch)
  }, [entries, isScheduleSearchActive, scheduleSearch, selectedEntries])

  function updateScheduleSearch(field, value) {
    setScheduleSearch((currentSearch) => ({
      ...currentSearch,
      [field]: value,
    }))
  }

  function clearScheduleSearch() {
    setScheduleSearch({
      title: '',
      dateTimeFrom: '',
      dateTimeTo: '',
    })
  }

  function selectDate(date) {
    setSelectedDateKey(formatDateKey(date))

    if (
      date.getMonth() !== viewDate.getMonth() ||
      date.getFullYear() !== viewDate.getFullYear()
    ) {
      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  function moveMonth(amount) {
    const nextViewDate = shiftCalendarMonth(viewDate, amount)
    setViewDate(nextViewDate)
    setSelectedDateKey(formatDateKey(nextViewDate))
  }

  function goToToday() {
    const nextToday = new Date()
    setViewDate(new Date(nextToday.getFullYear(), nextToday.getMonth(), 1))
    setSelectedDateKey(formatDateKey(nextToday))
  }

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Month view
              </p>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                {formatCalendarMonth(viewDate)}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={goToToday}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Today
            </button>
            <button
              type="button"
              disabled={hasReachedLimit}
              onClick={() => onCreate?.(selectedDateKey)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {hasReachedLimit ? 'Schedule limit reached' : 'Add target'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[56rem]">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/60">
              {CALENDAR_WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
                >
                  {weekday.slice(0, 3)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((date) => {
                const dateKey = formatDateKey(date)
                const dateEntries = entriesByDate.get(dateKey) ?? []
                const isCurrentMonth = date.getMonth() === viewDate.getMonth()
                const isSelected = dateKey === selectedDateKey
                const isToday = isTodayDateKey(dateKey)

                return (
                  <div
                    key={dateKey}
                    className={`group min-h-36 border-b border-r border-slate-100 p-2 transition dark:border-slate-800 ${
                      isCurrentMonth
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/70 dark:bg-slate-950/50'
                    } ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => selectDate(date)}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold transition ${
                          isToday
                            ? 'bg-blue-600 text-white'
                            : isCurrentMonth
                              ? 'text-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-100 dark:hover:bg-blue-950/60 dark:hover:text-blue-200'
                              : 'text-slate-400 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-800'
                        }`}
                        aria-label={`Select ${formatCalendarDate(dateKey)}`}
                      >
                        {date.getDate()}
                      </button>
                      <button
                        type="button"
                        disabled={hasReachedLimit}
                        onClick={() => {
                          selectDate(date)
                          onCreate?.(dateKey)
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-blue-950/60 dark:hover:text-blue-200"
                        aria-label={`Add target on ${formatCalendarDate(dateKey)}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-1 grid gap-1.5">
                      {loading
                        ? Array.from({ length: 2 }).map((_, index) => (
                            <div
                              key={`${dateKey}-loading-${index}`}
                              className="h-6 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                            />
                          ))
                        : dateEntries.slice(0, 2).map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => {
                                setSelectedDateKey(dateKey)
                                onEdit?.(entry)
                              }}
                              className="w-full truncate rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-left text-xs font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:border-blue-700"
                              title={entry.title}
                            >
                              {entry.time ? `${formatCalendarTime(entry.time)} ` : ''}
                              {entry.title}
                            </button>
                          ))}
                      {!loading && dateEntries.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => selectDate(date)}
                          className="px-2 py-1 text-left text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                        >
                          +{dateEntries.length - 2} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Selected day
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {formatCalendarDate(selectedDateKey)}
            </h2>
          </div>
          <button
            type="button"
            disabled={hasReachedLimit}
            onClick={() => onCreate?.(selectedDateKey)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
          >
            <Plus className="h-4 w-4" />
            {hasReachedLimit
              ? 'Schedule limit reached'
              : 'Add target to this day'}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Search className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                Search schedules
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Search by title and narrow results with date and time ranges.
              </p>
            </div>
            {isScheduleSearchActive ? (
              <button
                type="button"
                onClick={clearScheduleSearch}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                Clear search
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Schedule title
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={scheduleSearch.title}
                  onChange={(event) =>
                    updateScheduleSearch('title', event.target.value)
                  }
                  placeholder="Search title..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
                />
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                From date &amp; time
              </span>
              <input
                type="datetime-local"
                value={scheduleSearch.dateTimeFrom}
                onChange={(event) =>
                  updateScheduleSearch('dateTimeFrom', event.target.value)
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                To date &amp; time
              </span>
              <input
                type="datetime-local"
                value={scheduleSearch.dateTimeTo}
                min={scheduleSearch.dateTimeFrom || undefined}
                onChange={(event) =>
                  updateScheduleSearch('dateTimeTo', event.target.value)
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
              />
            </label>
          </div>
        </div>

        {isScheduleSearchActive ? (
          <p className="mt-5 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {displayedEntries.length} schedule
            {displayedEntries.length === 1 ? '' : 's'} match your search
          </p>
        ) : null}

        {displayedEntries.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {displayedEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-bold text-slate-950 dark:text-white">
                      {entry.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {isScheduleSearchActive ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatCalendarDate(entry.dateKey)}
                        </span>
                      ) : null}
                      {entry.time ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatCalendarTime(entry.time)}
                        </span>
                      ) : (
                        <span>All day</span>
                      )}
                      {entry.reminderEnabled ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                          <Bell className="h-3.5 w-3.5" />
                          Reminder {formatCalendarTime(entry.reminderTime)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit?.(entry)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/60 dark:hover:text-blue-200"
                      aria-label={`Edit ${entry.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(entry)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                      aria-label={`Delete ${entry.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {entry.note ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {entry.note}
                  </p>
                ) : null}

                <EntryLinks
                  entry={entry}
                  projectLookup={projectLookup}
                  launchpadLookup={launchpadLookup}
                  taskGroupLookup={taskGroupLookup}
                  onOpenProject={onOpenProject}
                  onOpenTaskGroup={onOpenTaskGroup}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
              {isScheduleSearchActive
                ? 'No schedules match this search.'
                : 'No targets scheduled for this day.'}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isScheduleSearchActive
                ? 'Try changing the title, date range, or time range.'
                : 'Add a target or select another date in the month view.'}
            </p>
          </div>
        )}

        <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          <Bell className="mr-1 inline h-3.5 w-3.5" />
          Reminder notifications are shown in ProMana while this browser tab is
          open. Browser-only apps cannot guarantee alarms after the tab is closed.
        </p>
      </section>
    </div>
  )
}
