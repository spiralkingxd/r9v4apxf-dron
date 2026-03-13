export default function TeamDetailLoading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10 lg:px-10">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-700" />

        <section className="rounded-[2rem] border border-white/10 bg-white/4 p-8">
          <div className="flex flex-wrap items-start gap-6">
            <div className="h-20 w-20 animate-pulse rounded-2xl bg-slate-700" />
            <div className="space-y-2">
              <div className="h-8 w-56 animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-40 animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-48 animate-pulse rounded bg-slate-700" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-700" />
            <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-700" />
          </div>

          <div className="mt-4 h-11 w-60 animate-pulse rounded-xl bg-slate-700" />
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <section key={i} className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
              <div className="h-6 w-44 animate-pulse rounded bg-slate-700" />
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((r) => (
                  <div key={r} className="h-16 animate-pulse rounded-xl bg-slate-700/80" />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
