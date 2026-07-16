import { createElement, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  FolderKanban,
  Globe2,
  ListTodo,
  LoaderCircle,
  Plus,
  X,
} from 'lucide-react'
import { formatDateKey } from '../utils/calendar'

function normalizeIdList(value) {
  return Array.isArray(value) ? value.map(String) : []
}

function getDefaultDraft(entry, initialDateKey) {
  return {
    title: entry?.title ?? '',
    note: entry?.note ?? '',
    dateKey: entry?.dateKey ?? initialDateKey ?? formatDateKey(new Date()),
    time: entry?.time ?? '',
    reminderEnabled: Boolean(entry?.reminderEnabled),
    reminderTime: entry?.reminderTime || entry?.time || '09:00',
    projectIds: normalizeIdList(entry?.projectIds),
    launchpadItemIds: normalizeIdList(entry?.launchpadItemIds),
    taskGroupIds: normalizeIdList(entry?.taskGroupIds),
  }
}

function LinkPicker({
  icon,
  title,
  description,
  items,
  selectedIds,
  onToggle,
  emptyMessage,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedItems = items.filter((item) => selectedIds.includes(item.id))
  const availableItems = items.filter((item) => !selectedIds.includes(item.id))

  return (
    <section className="rounded-2xl border border-gray-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300">
          {createElement(icon, { className: 'h-4 w-4' })}
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            Selected
          </p>
          {selectedItems.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedItems.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100"
                >
                  <span className="truncate">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-200 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-800 dark:hover:text-white"
                    aria-label={`Remove ${item.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Nothing selected yet.
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
            disabled={items.length === 0}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700"
            aria-expanded={isOpen}
          >
            <span>
              {items.length > 0
                ? `Select ${title.toLowerCase()}${
                    selectedItems.length > 0
                      ? ` (${selectedItems.length})`
                      : ''
                  }`
                : emptyMessage}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isOpen ? (
            <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {availableItems.length > 0 ? (
                availableItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50 hover:text-blue-800 dark:text-slate-200 dark:hover:bg-blue-950/60 dark:hover:text-blue-100"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {item.meta ? (
                      <span className="shrink-0 text-xs text-slate-400">
                        {item.meta}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  {items.length > 0
                    ? `All ${title.toLowerCase()} are selected.`
                    : emptyMessage}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function CalendarEntryModalForm({
  entry,
  initialDateKey,
  projects,
  launchpadItems,
  taskGroups,
  onClose,
  onSubmit,
  isSaving,
}) {
  const [draft, setDraft] = useState(() =>
    getDefaultDraft(entry, initialDateKey),
  )
  const [formError, setFormError] = useState('')
  const isEditing = Boolean(entry?.id)

  const projectOptions = projects.map((project) => ({
    id: project.id,
    label: project.displayName || 'Untitled project',
    meta: project.primaryLanguage || '',
  }))
  const launchpadOptions = launchpadItems.map((item) => ({
    id: item.id,
    label: item.name || 'Untitled shortcut',
    meta: item.category || '',
  }))
  const taskGroupOptions = taskGroups.map((taskGroup) => ({
    id: taskGroup.id,
    label: taskGroup.title || 'Untitled task group',
    meta: `${taskGroup.tasks.filter((task) => task.status === 'done').length}/${taskGroup.tasks.length} done`,
  }))

  function updateDraft(name, value) {
    setDraft((currentDraft) => ({ ...currentDraft, [name]: value }))
  }

  function toggleLinkedId(field, id) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: currentDraft[field].includes(id)
        ? currentDraft[field].filter((currentId) => currentId !== id)
        : [...currentDraft[field], id],
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const title = draft.title.trim()

    if (!title) {
      setFormError('Add a title for this target.')
      return
    }

    if (!draft.dateKey) {
      setFormError('Choose a calendar date.')
      return
    }

    if (draft.reminderEnabled && !draft.reminderTime) {
      setFormError('Choose a reminder time.')
      return
    }

    setFormError('')
    void onSubmit?.({
      title,
      note: draft.note.trim(),
      dateKey: draft.dateKey,
      time: draft.time,
      reminderEnabled: draft.reminderEnabled,
      reminderTime: draft.reminderEnabled ? draft.reminderTime : '',
      projectIds: draft.projectIds,
      launchpadItemIds: draft.launchpadItemIds,
      taskGroupIds: draft.taskGroupIds,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-3 sm:items-center sm:px-4 sm:py-6"
      onClick={isSaving ? undefined : onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-7 dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              <CalendarDays className="h-4 w-4" />
              Calendar workspace
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {isEditing ? 'Edit scheduled target' : 'Schedule a new target'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Add the outcome you want to reach, then connect the workspace items
              you will need when that day arrives.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close calendar entry modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="mt-6 flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Target title
                </span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => updateDraft('title', event.target.value)}
                  placeholder="For example, Ship onboarding flow"
                  autoFocus
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Date
                </span>
                <input
                  type="date"
                  value={draft.dateKey}
                  onChange={(event) => updateDraft('dateKey', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Time
                </span>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(event) => updateDraft('time', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Target note
              </span>
              <textarea
                value={draft.note}
                onChange={(event) => updateDraft('note', event.target.value)}
                rows={4}
                placeholder="Describe the result, preparation, or definition of done..."
                className="min-h-28 resize-y rounded-2xl border border-gray-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              />
            </label>

            <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={draft.reminderEnabled}
                    onChange={(event) =>
                      updateDraft('reminderEnabled', event.target.checked)
                    }
                    className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100">
                      <Bell className="h-4 w-4" />
                      Remind me in ProMana
                    </span>
                    <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">
                      In-app reminders appear while ProMana is open.
                    </span>
                  </span>
                </label>
                {draft.reminderEnabled ? (
                  <input
                    type="time"
                    value={draft.reminderTime}
                    onChange={(event) =>
                      updateDraft('reminderTime', event.target.value)
                    }
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-white dark:focus:ring-amber-500/20"
                    aria-label="Reminder time"
                  />
                ) : null}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              <LinkPicker
                icon={FolderKanban}
                title="Projects"
                description="Link local workspaces needed for this target."
                items={projectOptions}
                selectedIds={draft.projectIds}
                onToggle={(id) => toggleLinkedId('projectIds', id)}
                emptyMessage="No projects are available yet."
              />
              <LinkPicker
                icon={Globe2}
                title="Launchpad"
                description="Attach websites and tools for quick access."
                items={launchpadOptions}
                selectedIds={draft.launchpadItemIds}
                onToggle={(id) => toggleLinkedId('launchpadItemIds', id)}
                emptyMessage="No Launchpad shortcuts are available yet."
              />
              <LinkPicker
                icon={ListTodo}
                title="Task groups"
                description="Connect the checklists that drive this target."
                items={taskGroupOptions}
                selectedIds={draft.taskGroupIds}
                onToggle={(id) => toggleLinkedId('taskGroupIds', id)}
                emptyMessage="No task groups are available yet."
              />
            </div>

            {formError ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-200">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                ? 'Saving target...'
                : isEditing
                  ? 'Save target'
                  : 'Schedule target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CalendarEntryModal({
  open,
  entry,
  initialDateKey,
  projects = [],
  launchpadItems = [],
  taskGroups = [],
  onClose,
  onSubmit,
  isSaving = false,
}) {
  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <CalendarEntryModalForm
      key={entry?.id ?? `new-${initialDateKey}`}
      entry={entry}
      initialDateKey={initialDateKey}
      projects={projects}
      launchpadItems={launchpadItems}
      taskGroups={taskGroups}
      onClose={onClose}
      onSubmit={onSubmit}
      isSaving={isSaving}
    />,
    document.body,
  )
}
