import type { ReactNode } from "react";

type Props = {
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  action?: ReactNode;
};

const severityClasses: Record<Props["severity"], string> = {
  info: "border-cyan-300/25 bg-cyan-300/10",
  warning: "border-amber-300/25 bg-amber-300/10",
  error: "border-rose-300/25 bg-rose-300/10",
};

export function AlertBanner({ severity, title, description, action }: Props) {
  return (
    <article className={`rounded-xl border px-4 py-3 ${severityClasses[severity]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          <p className="mt-1 text-sm text-slate-300">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </article>
  );
}
