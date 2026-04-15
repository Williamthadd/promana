export default function NoteSkeletonCard() {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-10 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>

        <div className="space-y-2">
          <div className="h-6 w-2/3 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-1/3 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>

        <div className="rounded-2xl bg-slate-200 p-4 dark:bg-slate-800">
          <div className="space-y-2">
            <div className="h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="h-3 w-5/6 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="h-3 w-2/3 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    </article>
  )
}
