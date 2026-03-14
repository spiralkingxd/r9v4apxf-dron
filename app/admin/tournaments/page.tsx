import { Trophy } from "lucide-react";

import { getAdminEvents } from "@/app/admin/tournaments/_data";
import { EventsTable } from "@/components/admin/events-table";

export default async function AdminTournamentsPage() {
  const rows = await getAdminEvents();

  return (
    <section className="space-y-5">
      <header className="admin-surface rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-300" />
          <h1 className="text-2xl font-bold text-white">Gerenciamento de Torneios</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Controle torneios com chaveamento, rounds e cabeceamento configuráveis.
        </p>
      </header>

      <EventsTable rows={rows} />
    </section>
  );
}
