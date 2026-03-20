const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Last updated', value: 'lastUpdated' },
  { label: 'Last opened', value: 'lastOpened' },
  { label: 'Language', value: 'language' },
]

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={onChange}
        className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
      >
        {children}
      </select>
    </label>
  )
}

export default function SortFilterBar({
  sort,
  onSort,
  filterLang,
  onFilterLang,
  filterTag,
  onFilterTag,
  availableLangs,
  availableTags,
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SelectField label="Sort by" value={sort} onChange={onSort}>
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <SelectField label="Filter by language" value={filterLang} onChange={onFilterLang}>
        <option value="all">All languages</option>
        {availableLangs.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
      </SelectField>

      <SelectField label="Filter by tag" value={filterTag} onChange={onFilterTag}>
        <option value="all">All tags</option>
        {availableTags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </SelectField>
    </div>
  )
}
