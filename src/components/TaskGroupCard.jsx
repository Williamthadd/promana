import { useEffect, useState } from "react"
import {
  Check,
  CheckCircle2,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react"
import {
  getTaskStatusOption,
  TASK_STATUS_OPTIONS,
} from "../constants/taskStatuses"
import { formatRelativeTime } from "../utils/formatters"
import {
  normalizeTaskItems,
  setTaskCompletion,
  setTaskStatus,
} from "../utils/taskUtils"

export default function TaskGroupCard({
  taskGroup,
  onEdit,
  onDelete,
  onUpdateTasks,
  onSelectTag,
}) {
  const [visibleTasks, setVisibleTasks] = useState(() =>
    normalizeTaskItems(taskGroup.tasks),
  )
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setVisibleTasks(normalizeTaskItems(taskGroup.tasks))
  }, [taskGroup.tasks])

  const completedCount = visibleTasks.filter(
    (task) => task.status === "done",
  ).length
  const totalCount = visibleTasks.length
  const completionPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  async function saveTasks(nextTasks) {
    const previousTasks = visibleTasks
    setVisibleTasks(nextTasks)
    setIsUpdating(true)

    try {
      await onUpdateTasks?.(taskGroup, nextTasks)
    } catch {
      setVisibleTasks(previousTasks)
    } finally {
      setIsUpdating(false)
    }
  }

  function handleCompletionChange(taskId, isCompleted) {
    void saveTasks(setTaskCompletion(visibleTasks, taskId, isCompleted))
  }

  function handleStatusChange(taskId, status) {
    void saveTasks(setTaskStatus(visibleTasks, taskId, status))
  }

  return (
    <article className="flex min-h-full flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="break-words text-xl font-bold tracking-tight text-slate-950 dark:text-white">
              {taskGroup.title}
            </h3>
          </div>

          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onEdit?.(taskGroup)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-200"
              aria-label={`Edit ${taskGroup.title}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(taskGroup)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/50 dark:hover:text-red-300"
              aria-label={`Remove ${taskGroup.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {taskGroup.note ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
            {taskGroup.note}
          </p>
        ) : null}

        {taskGroup.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {taskGroup.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag?.(tag)}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {completedCount} of {totalCount} complete
            </span>
            <span className="font-bold text-blue-600 dark:text-blue-300">
              {completionPercent}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid max-h-96 gap-2 overflow-y-auto pr-1">
          {visibleTasks.map((task) => {
            const statusOption = getTaskStatusOption(task.status)

            return (
              <div
                key={task.id}
                className="grid gap-3 rounded-2xl border border-gray-100 p-3 dark:border-slate-800 sm:grid-cols-[auto_minmax(0,1fr)_9.5rem] sm:items-center"
              >
                <button
                  type="button"
                  onClick={() =>
                    handleCompletionChange(task.id, !task.isCompleted)
                  }
                  disabled={isUpdating}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-wait disabled:opacity-70 ${
                    task.isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-transparent hover:border-blue-400 dark:border-slate-600 dark:bg-slate-950"
                  }`}
                  aria-label={`${task.isCompleted ? "Mark incomplete" : "Mark complete"}: ${task.text}`}
                >
                  <Check className="h-4 w-4" />
                </button>

                <span
                  className={`min-w-0 break-words text-sm leading-5 ${
                    task.isCompleted
                      ? "text-slate-400 line-through dark:text-slate-500"
                      : "font-medium text-slate-800 dark:text-slate-100"
                  }`}
                >
                  {task.text}
                </span>

                <select
                  value={task.status}
                  onChange={(event) =>
                    handleStatusChange(task.id, event.target.value)
                  }
                  disabled={isUpdating}
                  className={`w-full rounded-xl border px-2.5 py-2 text-xs font-semibold outline-none transition focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70 dark:focus:ring-blue-500/20 ${statusOption.badgeClass}`}
                  aria-label={`Status for ${task.text}`}
                >
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-slate-500 dark:text-slate-400">
          <span>Updated {formatRelativeTime(taskGroup.lastUpdatedAt)}</span>
          {completedCount === totalCount && totalCount > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
