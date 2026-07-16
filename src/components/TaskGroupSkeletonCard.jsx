export default function TaskGroupSkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-white/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="h-7 w-1/2 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
      <div className="mt-4 h-4 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-5 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="mt-5 grid gap-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80"
          />
        ))}
      </div>
    </div>
  )
}
