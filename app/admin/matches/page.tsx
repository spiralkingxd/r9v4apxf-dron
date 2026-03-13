import { Swords } from "lucide-react";

import { getAdminMatches } from "@/app/admin/matches/_data";
import { MatchesTable } from "@/components/admin/matches-table";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminMatchesPage({ searchParams }: Props) {
  const query = await searchParams;
  const supabase = await createClient();
  const [rows, { data: eventsRaw }, { data: teamsRaw }] = await Promise.all([
    getAdminMatches(),
    supabase.from("events").select("id, title").order("start_date", { ascending: false }),
    supabase.from("teams").select("id, name").order("name", { ascending: true }),
  ]);

  const events = (eventsRaw ?? []).map((event) => ({ id: String(event.id), title: String(event.title) }));
  const teams = (teamsRaw ?? []).map((team) => ({ id: String(team.id), name: String(team.name) }));

  const eventId = firstValue(query.eventId);
  const status = firstValue(query.status);
  const round = firstValue(query.round);

  const statusFilter = status === "pending" || status === "in_progress" || status === "finished" || status === "cancelled" ? status : "all";

  const initialFilters = {
    eventId: eventId && events.some((event) => event.id === eventId) ? eventId : "all",
    status: statusFilter,
    round: round && /^\d+$/.test(round) ? round : "all",
  } as const;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <Swords className="h-6 w-6 text-cyan-300" />
          <h1 className="text-2xl font-bold text-white">Gerenciamento de Partidas</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Controle resultados, status, vencedor e histórico de todas as partidas da plataforma.
        </p>
      </header>

      <MatchesTable rows={rows} events={events} teams={teams} initialFilters={initialFilters} />
    </section>
  );
}
