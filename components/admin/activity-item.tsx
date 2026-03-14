import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  createdAt: string;
  href: string;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ActivityItem({ icon, title, createdAt, href }: Props) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm transition hover:border-white/20 hover:bg-white/5"
    >
      <span className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-slate-100">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{dateFmt.format(new Date(createdAt))}</span>
      </span>
    </Link>
  );
}
