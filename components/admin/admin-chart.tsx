import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function AdminChart({ title, subtitle, children, className }: Props) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-950/60 p-5 ${className ?? ""}`}>
      <header>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{subtitle}</p> : null}
      </header>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}
