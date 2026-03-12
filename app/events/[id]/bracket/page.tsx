import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Swords } from "lucide-react";

import { MatchResultForm } from "@/components/match-result-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  title: string;
  status: "draft" | "active" | "finished";
};

type MatchRow = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  winner_id: string | null;
  score_a: number;
  score_b: number;
  round: number;
  bracket_position: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Em breve",
  active: "Em andamento",
  finished: "Finalizado",
};

type Props = { params: Promise<{ id: string }> };

export default async function EventBracketPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    notFound();
  }

  const supabase = await createClient();

  const [
    { data: event },
    { data: matchesRaw },
    { data: teamsRaw },
    { data: { user } },
  ] = await Promise.all([
    supabase.from("events").select("id, title, status").eq("id", id).single<EventRow>(),
    supabase
      .from("matches")
      .select("id, team_a_id, team_b_id, winner_id, score_a, score_b, round, bracket_position")
      .eq("event_id", id)
      .order("round", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("teams").select("id, name"),
    supabase.auth.getUser(),
  ]);

  if (!event) {
    notFound();
  }

  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isAdmin = profile?.role === "admin";
  }

  const matches = (matchesRaw ?? []) as MatchRow[];
  const teamNameById = new Map<string, string>();

  for (const row of teamsRaw ?? []) {
    teamNameById.set(row.id as string, row.name as string);
  }

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

        {event.status === "draft" ? (
          <section className="rounded-2xl border border-amber-400/25 bg-amber-400/8 px-6 py-12 text-center">
            <h2 className="text-2xl font-semibold text-amber-300">Em breve</h2>
            <p className="mt-3 text-sm text-amber-200/80">
              O chaveamento será disponibilizado quando o evento começar.
            </p>
          </section>
        ) : matches.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-slate-400">
            Nenhum confronto cadastrado para este evento.
          </section>
        ) : (
          <section className="overflow-x-auto pb-4">
            <div className="flex min-w-max gap-6">
              {rounds.map(([roundNumber, roundMatches]) => (
                <div key={roundNumber} className="w-[320px] shrink-0 space-y-4">
                  <h2 className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-cyan-200">
                    Rodada {roundNumber}
                  </h2>

                  {roundMatches.map((match) => {
                    const teamAName = teamNameById.get(match.team_a_id) ?? "Equipe A";
                    const teamBName = teamNameById.get(match.team_b_id) ?? "Equipe B";

                    return (
                      <article
                        key={match.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl shadow-black/20"
                      >
                        <div className="space-y-2">
                          <TeamRow
                            name={teamAName}
                            score={match.score_a}
                            isWinner={match.winner_id === match.team_a_id}
                          />
                          <TeamRow
                            name={teamBName}
                            score={match.score_b}
                            isWinner={match.winner_id === match.team_b_id}
                          />
                        </div>

                        {match.bracket_position ? (
                          <p className="mt-3 text-xs text-slate-500">Posição: {match.bracket_position}</p>
                        ) : null}

                        {isAdmin ? (
                          <MatchResultForm
                            eventId={event.id}
                            matchId={match.id}
                            teamAId={match.team_a_id}
                            teamBId={match.team_b_id}
                            scoreA={match.score_a}
                            scoreB={match.score_b}
                          />
                        ) : null}
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

function TeamRow({ name, score, isWinner }: { name: string; score: number; isWinner: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
        isWinner
          ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-200",
      )}
    >
      <span className="flex items-center gap-2 truncate pr-3">
        {isWinner ? <Crown className="h-3.5 w-3.5 shrink-0" /> : <Swords className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{name}</span>
      </span>
      <span className="text-base font-bold">{score}</span>
    </div>
  );
}
