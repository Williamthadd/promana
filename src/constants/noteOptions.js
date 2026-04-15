export const NOTE_TYPE_OPTIONS = [
  { value: "snippet", label: "Code snippet" },
  { value: "query", label: "SQL query" },
  { value: "config", label: "Config note" },
  { value: "text", label: "Text note" },
  { value: "reference", label: "Reference" },
]

export const NOTE_LANGUAGE_OPTIONS = [
  { value: "plaintext", label: "Plain text (.txt)" },
  { value: "sql", label: "SQL (.sql)" },
  { value: "golang", label: "Go (.go)" },
  { value: "python", label: "Python (.py)" },
  { value: "yaml", label: "YAML / YML (.yml)" },
  { value: "json", label: "JSON (.json)" },
  { value: "javascript", label: "JavaScript (.js)" },
  { value: "typescript", label: "TypeScript (.ts)" },
  { value: "bash", label: "Shell / Bash (.sh)" },
  { value: "markdown", label: "Markdown (.md)" },
  { value: "toml", label: "TOML (.toml)" },
  { value: "ini", label: "INI (.ini)" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "env", label: ".env" },
]

export const NOTE_TYPE_LABELS = Object.fromEntries(
  NOTE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

export const NOTE_LANGUAGE_LABELS = Object.fromEntries(
  NOTE_LANGUAGE_OPTIONS.map((option) => [option.value, option.label]),
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

export const NOTE_LANGUAGE_COLOR_CLASSES = {
  plaintext:
    "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
  sql: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  golang: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200",
  python:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  yaml:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  json: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  javascript:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-200",
  typescript:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  bash: "bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-200",
  markdown:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  toml: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
  ini: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  dockerfile:
    "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  env: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-200",
}

export const NOTE_CODE_PANEL_CLASSES = {
  plaintext: "from-slate-950 via-slate-900 to-slate-800",
  sql: "from-violet-950 via-slate-950 to-slate-900",
  golang: "from-cyan-950 via-slate-950 to-slate-900",
  python: "from-blue-950 via-slate-950 to-amber-950",
  yaml: "from-emerald-950 via-slate-950 to-slate-900",
  json: "from-rose-950 via-slate-950 to-slate-900",
  javascript: "from-yellow-950 via-slate-950 to-slate-900",
  typescript: "from-blue-950 via-slate-950 to-slate-900",
  bash: "from-lime-950 via-slate-950 to-slate-900",
  markdown: "from-indigo-950 via-slate-950 to-slate-900",
  toml: "from-orange-950 via-slate-950 to-slate-900",
  ini: "from-teal-950 via-slate-950 to-slate-900",
  dockerfile: "from-sky-950 via-slate-950 to-slate-900",
  env: "from-green-950 via-slate-950 to-slate-900",
}

export function normalizeNoteType(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase()

  return NOTE_TYPE_LABELS[normalizedValue] ? normalizedValue : "text"
}

export function normalizeNoteLanguage(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase()

  return NOTE_LANGUAGE_LABELS[normalizedValue] ? normalizedValue : "plaintext"
}

export function getNoteTypeLabel(value) {
  return NOTE_TYPE_LABELS[normalizeNoteType(value)] ?? "Text note"
}

export function getNoteLanguageLabel(value) {
  return NOTE_LANGUAGE_LABELS[normalizeNoteLanguage(value)] ?? "Plain text (.txt)"
}
