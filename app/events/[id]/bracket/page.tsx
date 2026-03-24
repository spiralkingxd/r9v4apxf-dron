import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicServerClient } from "@/lib/supabase/public-server";

type EventRow = {
  id: string;
  title: string;
  status: "registrations_open" | "check_in" | "started" | "finished";
};

type MatchRow = {
  id: string;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  score_a: number;
  score_b: number;
  round: number;
  bracket_position: string | null;
  status: "pending" | "in_progress" | "finished" | "cancelled";
  scheduled_at: string | null;
  created_at: string;
};

type TeamMeta = {
  name: string;
  logoUrl: string | null;
  memberCount: number;
};

const STATUS_LABELS: Record<string, string> = {
  registrations_open: "Inscricoes abertas",
  check_in: "Check-in",
  started: "Em andamento",
  finished: "Finalizado",
};

const MATCH_STATUS_LABELS: Record<MatchRow["status"], string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

type Props = { params: Promise<{ id: string }> };

async function getCachedEventBracketData(eventId: string) {
  const fetcher = unstable_cache(
    async () => {
      const supabase = createPublicServerClient();

      const [{ data: event }, { data: matchesRaw }, { data: teamsRaw }, { data: teamMembersRaw }] = await Promise.all([
        supabase.from("events").select("id, title, status").eq("id", eventId).single<EventRow>(),
        supabase
          .from("matches")
          .select("id, team_a_id, team_b_id, winner_id, score_a, score_b, round, bracket_position, status, scheduled_at, created_at")
          .eq("event_id", eventId)
          .order("round", { ascending: true })
          .order("bracket_position", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase.from("teams").select("id, name, logo_url"),
        supabase.from("team_members").select("team_id"),
      ]);

      return {
        event: event ?? null,
        matchesRaw: (matchesRaw ?? []) as MatchRow[],
        teamsRaw: teamsRaw ?? [],
        teamMembersRaw: teamMembersRaw ?? [],
      };
    },
    [`event-bracket-${eventId}`],
    {
      tags: ["events", "public-data", `event:${eventId}`, `event-bracket:${eventId}`],
      revalidate: 60,
    },
  );

  return fetcher();
}

export default async function EventBracketPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    notFound();
  }

  const { event, matchesRaw, teamsRaw, teamMembersRaw } = await getCachedEventBracketData(id);

  if (!event) {
    notFound();
  }

  const matches = (matchesRaw ?? []) as MatchRow[];
  const teamMemberCountById = new Map<string, number>();

  for (const row of teamMembersRaw ?? []) {
    const teamId = String(row.team_id);
    teamMemberCountById.set(teamId, (teamMemberCountById.get(teamId) ?? 0) + 1);
  }

  const teamById = new Map<string, TeamMeta>();

  for (const row of teamsRaw ?? []) {
    const teamId = String(row.id);
    teamById.set(teamId, {
      name: String(row.name),
      logoUrl: (row.logo_url as string | null) ?? null,
      // Inclui capitão na contagem além da tabela team_members.
      memberCount: (teamMemberCountById.get(teamId) ?? 0) + 1,
    });
  }

  const shouldShowComingSoon = (event.status === "registrations_open" || event.status === "check_in") && matches.length === 0;

  const groupedByRound = new Map<number, MatchRow[]>();
  for (const match of matches) {
    const roundMatches = groupedByRound.get(match.round) ?? [];
    roundMatches.push(match);
    groupedByRound.set(match.round, roundMatches);
  }

  const rounds = [...groupedByRound.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] px-6 py-10 text-slate-100 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href={`/events/${event.id}`} className="text-sm text-slate-400 hover:text-slate-200">
              ← Voltar ao evento
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-white">Chaveamento</h1>
            <p className="mt-1 text-sm text-slate-400">
              {event.title} · {STATUS_LABELS[event.status] ?? event.status}
            </p>
          </div>
        </div>

        {shouldShowComingSoon ? (
          <section className="rounded-2xl border border-amber-400/25 bg-amber-400/8 px-6 py-12 text-center">
            <h2 className="text-2xl font-semibold text-amber-300">Em breve</h2>
            <p className="mt-3 text-sm text-amber-200/80">
              O chaveamento será disponibilizado quando o evento entrar em andamento.
            </p>
          </section>
        ) : matches.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-slate-400">
            Nenhum confronto cadastrado para este evento.
          </section>
        ) : (
          <section className="space-y-4">
            {rounds.map(([roundNumber, roundMatches]) => (
              <div key={roundNumber} className="rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="border-b border-white/10 px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                    Rodada {roundNumber}
                  </h2>
                </div>

                <div className="divide-y divide-white/10">
                  {roundMatches.map((match) => {
                    const teamAName = match.team_a_id
                      ? (teamById.get(match.team_a_id)?.name ?? "Equipe removida")
                      : "A definir";
                    const teamBName = match.team_b_id
                      ? (teamById.get(match.team_b_id)?.name ?? "Equipe removida")
                      : "A definir";
                    const scoreText =
                      match.status === "finished" || match.status === "in_progress"
                        ? `${match.score_a} - ${match.score_b}`
                        : "vs";

                    return (
                      <div key={match.id} className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 text-slate-300">
                          <span className="min-w-[8rem] truncate">{teamAName}</span>
                          <span className="font-semibold text-slate-100">{scoreText}</span>
                          <span className="min-w-[8rem] truncate">{teamBName}</span>
                          <span className="ml-auto text-xs text-slate-400">
                            {MATCH_STATUS_LABELS[match.status]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
