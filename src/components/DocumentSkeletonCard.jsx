export default function DocumentSkeletonCard() {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/50 shadow-md glass-panel-light dark:border-white/10 dark:glass-panel-dark">
      <div className="aspect-[16/10] animate-pulse bg-slate-200/80 dark:bg-slate-800" />
      <div className="grid gap-4 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
        <div className="flex gap-2">
          <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
        </div>
        <div className="h-11 animate-pulse rounded-2xl bg-blue-100 dark:bg-blue-950" />
      </div>
    </article>
  )
}
