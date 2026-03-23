import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";

import { getMatchesByEvent } from "@/app/admin/matches/_data";
import { FirstRoundDrawButton } from "@/components/admin/first-round-draw-button";
import { MatchesTable } from "@/components/admin/matches-table";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TournamentMatchesPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{ event, matches }, { data: teamsRaw }, { data: { user } }, { count: approvedTeamsCountRaw }] = await Promise.all([
    getMatchesByEvent(id),
    supabase.from("teams").select("id, name").order("name", { ascending: true }),
    supabase.auth.getUser(),
    supabase.from("registrations").select("team_id", { count: "exact", head: true }).eq("event_id", id).eq("status", "approved"),
  ]);

  let isAdminUser = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: "user" | "admin" | "owner" }>();
    isAdminUser = profile?.role === "admin" || profile?.role === "owner";
  }

  const approvedTeamsCount = approvedTeamsCountRaw ?? 0;
  const isRegistrationClosed = event.status !== "registrations_open";
  const hasEnoughTeams = approvedTeamsCount >= 2;
  const hasNoBracketYet = matches.length === 0;
  const canGenerateFirstRound = isAdminUser && isRegistrationClosed && hasEnoughTeams && hasNoBracketYet;

  const teams = (teamsRaw ?? []).map((team) => ({ id: String(team.id), name: String(team.name) }));
  const events = [{ id: event.id, title: event.title }];

  const statusRaw = firstValue(query.status);
  const roundRaw = firstValue(query.round);
  const statusFilter =
    statusRaw === "pending" || statusRaw === "in_progress" || statusRaw === "finished" || statusRaw === "cancelled"
      ? statusRaw
      : "all";

  const initialFilters = {
    eventId: id,
    status: statusFilter,
    round: roundRaw && /^\d+$/.test(roundRaw) ? roundRaw : "all",
  } as const;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-6">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/admin/tournaments" className="hover:text-slate-700 dark:hover:text-slate-200">
            Torneios
          </Link>
          <span>/</span>
          <Link href={`/admin/tournaments/${id}`} className="hover:text-slate-700 dark:hover:text-slate-200">
            {event.title}
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-200">Partidas</span>
        </nav>

        <div className="mt-4 flex items-center gap-3">
          <Swords className="h-6 w-6 text-cyan-300" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Partidas — {event.title}</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Gerencie resultados, status e histórico das partidas deste torneio.
        </p>

        {canGenerateFirstRound ? (
          <div className="mt-4">
            <FirstRoundDrawButton
              eventId={id}
              approvedTeamsCount={approvedTeamsCount}
              estimatedFirstRoundMatches={Math.ceil(approvedTeamsCount / 2)}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/tournaments/${id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao torneio
          </Link>
          <Link
            href={`/admin/tournaments/${id}/bracket`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-white/10"
          >
            Ver chaveamento
          </Link>
        </div>
      </header>

      <MatchesTable
        rows={matches}
        events={events}
        teams={teams}
        initialFilters={initialFilters}
        detailBasePath={`/admin/tournaments/${id}/matches`}
      />
    </section>
  );
}
