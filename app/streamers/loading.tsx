export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-6 h-24 animate-pulse rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5" />
      <div className="mb-5 h-14 animate-pulse rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5" />
        ))}
      </div>
    </main>
  );
}
