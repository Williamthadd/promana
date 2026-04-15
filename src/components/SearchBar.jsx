import { Search } from "lucide-react"

export default function SearchBar({
  value,
  onChange,
  inputRef,
  placeholder = "Search project folder name....",
}) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/70 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
      />
    </label>
  )
}
