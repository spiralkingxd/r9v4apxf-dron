function SkeletonCard() {
  return <div className="h-36 animate-pulse rounded-2xl border border-white/10 bg-slate-900/60" />;
}

function SkeletonPanel({ heightClass }: { heightClass: string }) {
  return <div className={`${heightClass} animate-pulse rounded-2xl border border-white/10 bg-slate-900/60`} />;
}

export default function LoadingDashboard() {
  return (
    <section className="space-y-6">
      <SkeletonPanel heightClass="h-32" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonPanel heightClass="h-96 lg:col-span-2" />
        <SkeletonPanel heightClass="h-96" />
        <SkeletonPanel heightClass="h-96 lg:col-span-3" />
      </div>

      <SkeletonPanel heightClass="h-64" />
      <SkeletonPanel heightClass="h-80" />
    </section>
  );
}
