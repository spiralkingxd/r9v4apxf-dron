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
      className="group rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-900/70"
      style={{ animation: "dashboard-fade-in 0.45s ease-out both", animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{helper}</p>
        </div>
        <span className={`rounded-xl border p-3 transition group-hover:scale-105 ${tones[tone]}`}>
          {icon}
        </span>
      </div>
    </article>
  );
}
