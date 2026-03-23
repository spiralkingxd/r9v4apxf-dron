import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { Crown, Swords } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import { cn } from "@/lib/utils";

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

const fmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

function getBracketOrderValue(position: string | null) {
  if (!position) return Number.MAX_SAFE_INTEGER;
  const match = /^R(\d+)-M(\d+)$/i.exec(position.trim());
  if (!match) return Number.MAX_SAFE_INTEGER - 1;
  const round = Number(match[1]);
  const slot = Number(match[2]);
  return round * 10_000 + slot;
}

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

  const groupedByRound = new Map<number, MatchRow[]>();
  for (const match of matches) {
    const roundMatches = groupedByRound.get(match.round) ?? [];
    roundMatches.push(match);
    groupedByRound.set(match.round, roundMatches);
  }

  const rounds = [...groupedByRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([roundNumber, roundMatches]) => [
      roundNumber,
      [...roundMatches].sort((a, b) => {
        const posDiff = getBracketOrderValue(a.bracket_position) - getBracketOrderValue(b.bracket_position);
        if (posDiff !== 0) return posDiff;
        return a.created_at.localeCompare(b.created_at);
      }),
    ] as const);

  const shouldShowComingSoon = (event.status === "registrations_open" || event.status === "check_in") && matches.length === 0;

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
          <section className="overflow-x-auto pb-4">
            <div className="flex min-w-max gap-6 md:gap-8">
              {rounds.map(([roundNumber, roundMatches]) => (
                <div key={roundNumber} className="relative w-[300px] shrink-0 space-y-4 md:w-[320px]">
                  <h2 className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-cyan-200">
                    Rodada {roundNumber}
                  </h2>

                  {roundMatches.map((match) => {
                    const teamA = match.team_a_id ? teamById.get(match.team_a_id) : null;
                    const teamB = match.team_b_id ? teamById.get(match.team_b_id) : null;
                    const teamAName = match.team_a_id ? teamA?.name ?? "Equipe removida" : "A definir (TBD)";
                    const teamBName = match.team_b_id ? teamB?.name ?? "Equipe removida" : "A definir (TBD)";
                    const showScores = match.status === "in_progress" || match.status === "finished";
                    const hasBothTeams = Boolean(match.team_a_id && match.team_b_id);
                    const isByeMatch = Boolean(match.winner_id && (!match.team_a_id || !match.team_b_id));

                    return (
                      <article
                        key={match.id}
                        className={cn(
                          "relative rounded-2xl border p-4 shadow-xl shadow-black/20",
                          hasBothTeams ? "border-white/10 bg-slate-950/60" : "border-dashed border-white/20 bg-slate-950/45",
                        )}
                      >
                        {/* Conector visual para próxima rodada (desktop) */}
                        {roundNumber !== rounds[rounds.length - 1]?.[0] ? (
                          <div className="pointer-events-none absolute -right-8 top-1/2 hidden h-px w-8 -translate-y-1/2 bg-cyan-300/20 md:block" />
                        ) : null}

                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">{match.bracket_position ?? "Sem posição"}</span>
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
                              match.status === "finished" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
                              match.status === "in_progress" && "border-sky-400/30 bg-sky-400/10 text-sky-200",
                              match.status === "pending" && "border-amber-400/30 bg-amber-400/10 text-amber-200",
                              match.status === "cancelled" && "border-rose-400/30 bg-rose-400/10 text-rose-200",
                            )}
                          >
                            {MATCH_STATUS_LABELS[match.status]}
                          </span>
                        </div>

                        {match.round === 1 ? (
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-cyan-100">
                              Sorteado
                            </span>
                            <span className="text-slate-500">{fmt.format(new Date(match.created_at))}</span>
                          </div>
                        ) : null}

                        {isByeMatch ? (
                          <p className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-200">
                            BYE: avanço automático para a próxima fase.
                          </p>
                        ) : null}

                        <div className="space-y-2">
                          <TeamRow
                            name={teamAName}
                            logoUrl={teamA?.logoUrl ?? null}
                            memberCount={teamA?.memberCount ?? null}
                            score={showScores ? match.score_a : null}
                            isWinner={match.winner_id === match.team_a_id}
                            isPending={!match.team_a_id}
                          />
                          <TeamRow
                            name={teamBName}
                            logoUrl={teamB?.logoUrl ?? null}
                            memberCount={teamB?.memberCount ?? null}
                            score={showScores ? match.score_b : null}
                            isWinner={match.winner_id === match.team_b_id}
                            isPending={!match.team_b_id}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span>
                            {match.scheduled_at ? `Agendada: ${fmt.format(new Date(match.scheduled_at))}` : "Data/horário a definir"}
                          </span>
                          {!hasBothTeams ? <span className="text-amber-200/80">Aguardando definição de equipes</span> : null}
                        </div>

                      </article>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function TeamRow({
  name,
  logoUrl,
  memberCount,
  score,
  isWinner,
  isPending,
}: {
  name: string;
  logoUrl: string | null;
  memberCount: number | null;
  score: number | null;
  isWinner: boolean;
  isPending: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
        isPending
          ? "border-dashed border-white/20 bg-white/[0.03] text-slate-400"
          : isWinner
            ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
            : "border-white/10 bg-white/5 text-slate-200",
      )}
    >
      <span className="flex items-center gap-2 truncate pr-3">
        {logoUrl ? <img src={logoUrl} alt={`Logo da equipe ${name}`} className="h-4 w-4 shrink-0 rounded-full object-cover" /> : null}
        {isWinner ? <Crown className="h-3.5 w-3.5 shrink-0" /> : <Swords className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{name}</span>
        {memberCount ? <span className="text-[10px] text-slate-500">({memberCount})</span> : null}
      </span>
      <span className="text-base font-bold">{score ?? "-"}</span>
    </div>
  );
}
