import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
  delayMs?: number;
};

const tones: Record<NonNullable<Props["tone"]>, string> = {
  info: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  danger: "border-rose-300/20 bg-rose-300/10 text-rose-100",
};

export function AdminStatCard({
  label,
  value,
  helper,
  icon,
  tone = "info",
  delayMs = 0,
}: Props) {
  return (
    <article
      className="admin-surface group rounded-2xl p-5 transition-all hover:-translate-y-0.5"
      style={{ animation: "dashboard-fade-in 0.45s ease-out both", animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[color:var(--text-strong)]">{value}</p>
          <p className="mt-1 text-sm text-[color:var(--text-muted)] opacity-80">{helper}</p>
        </div>
        <span className={`rounded-xl border p-3 backdrop-blur-md transition group-hover:scale-105 ${tones[tone]}`}>
          {icon}
        </span>
      </div>
    </article>
  );
}
