export const NOTE_TYPE_OPTIONS = [
  { value: "snippet", label: "Code snippet" },
  { value: "query", label: "SQL query" },
  { value: "config", label: "Config note" },
  { value: "text", label: "Text note" },
  { value: "reference", label: "Reference" },
]

export const NOTE_TYPE_LABELS = Object.fromEntries(
  NOTE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

export const NOTE_TYPE_COLOR_CLASSES = {
  snippet:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  query:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  config:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  text:
    "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
  reference:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
}

export const NOTE_TYPE_TEXT_COLOR_CLASSES = {
  snippet: "text-sky-200",
  query: "text-violet-200",
  config: "text-emerald-200",
  text: "text-slate-100",
  reference: "text-amber-200",
}

export const NOTE_TYPE_PANEL_CLASSES = {
  snippet: "from-blue-950 via-slate-950 to-cyan-950",
  query: "from-violet-950 via-slate-950 to-purple-950",
  config: "from-emerald-950 via-slate-950 to-teal-950",
  text: "from-slate-950 via-slate-900 to-slate-800",
  reference: "from-amber-950 via-slate-950 to-orange-950",
}

export function normalizeNoteType(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase()

  return NOTE_TYPE_LABELS[normalizedValue] ? normalizedValue : "text"
}

export function getNoteTypeLabel(value) {
  return NOTE_TYPE_LABELS[normalizeNoteType(value)] ?? "Text note"
}
