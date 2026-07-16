export const TASK_STATUS_OPTIONS = [
  {
    value: "not_started",
    label: "Not started",
    badgeClass:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  {
    value: "in_progress",
    label: "In progress",
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  },
  {
    value: "on_hold",
    label: "On hold",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  },
  {
    value: "done",
    label: "Done",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
]

const VALID_TASK_STATUSES = new Set(
  TASK_STATUS_OPTIONS.map((option) => option.value),
)

export function getDefaultTaskStatus(index) {
  return index === 0 ? "in_progress" : "not_started"
}

export function normalizeTaskStatus(value, fallback = "not_started") {
  return VALID_TASK_STATUSES.has(value) ? value : fallback
}

export function getTaskStatusOption(value) {
  return (
    TASK_STATUS_OPTIONS.find((option) => option.value === value) ??
    TASK_STATUS_OPTIONS[0]
  )
}
