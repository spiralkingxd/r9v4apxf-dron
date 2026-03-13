import { Medal } from "lucide-react";

import { getResultsData } from "@/app/admin/matches/_data";
import { ResultsTable } from "@/components/admin/results-table";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminResultsPage({ searchParams }: Props) {
  const query = await searchParams;
  const rows = await getResultsData();
  const eventId = firstValue(query.eventId);
  const initialFilters = {
    eventId: eventId && rows.some((row) => row.event_id === eventId) ? eventId : "all",
  };

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <Medal className="h-6 w-6 text-amber-300" />
          <h1 className="text-2xl font-bold text-white">Resultados</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Histórico de partidas finalizadas com exportação e ferramentas de recálculo/reversão.
        </p>
      </header>

      <ResultsTable rows={rows} initialFilters={initialFilters} />
    </section>
  );
}
