import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBadge } from "@/components/admin/admin-badge";

const sectionTitle: Record<string, string> = {
  torneios: "Torneios",
  membros: "Membros",
  members: "Membros",
  equipes: "Equipes",
  teams: "Equipes",
  partidas: "Partidas / Matches",
  matches: "Partidas / Matches",
  results: "Resultados",
  resultados: "Resultados",
  notifications: "Notificações",
  notificacoes: "Notificações",
  rankings: "Rankings",
  configuracoes: "Configurações",
  settings: "Configurações",
};

type Props = {
  params: Promise<{ section: string }>;
};

export default async function AdminSectionPlaceholderPage({ params }: Props) {
  const { section } = await params;
  const title = sectionTitle[section];

  if (!title) {
    notFound();
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Estrutura base criada. Nesta etapa, a navegação e o layout já estão prontos para evoluir cada módulo.
        </p>
        <div className="mt-3">
          <AdminBadge tone="pending">Em construção</AdminBadge>
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-sm text-slate-300">Use o dashboard para visão geral e atalhos administrativos.</p>
        <Link href="/admin/dashboard" className="mt-4 inline-flex rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">
          Voltar para Dashboard
        </Link>
      </div>
    </section>
  );
}
