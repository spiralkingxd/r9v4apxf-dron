import { Shield } from "lucide-react";

import { getTeams } from "@/app/admin/team-actions";
import { TeamsTable } from "@/components/admin/teams-table";

export default async function AdminTeamsPage() {
  const { data: rows } = await getTeams({ pageSize: 2000 });

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-white">
          <Shield className="h-6 w-6 text-cyan-300" />
          Gerenciamento de Equipes
        </h1>
        <p className="mt-2 text-sm text-slate-400">Monitore status, membros e ações de moderação em equipes.</p>
      </header>

      <TeamsTable rows={rows} />
    </section>
  );
}
