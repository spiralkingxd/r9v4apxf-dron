import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Coins, Scroll, Shield, Trophy, Users } from "lucide-react";

import { RegisterTeamForm } from "@/components/register-team-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  status: "draft" | "active" | "finished";
  start_date: string;
  end_date: string | null;
  prize_pool: number;
};

type TeamOption = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  draft: "Em breve",
  finished: "Finalizado",
};

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });
const fmtMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Props = { params: Promise<{ id: string }> };

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();

  const [
    { data: event },
    { count: registrationCount },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, rules, status, start_date, end_date, prize_pool")
      .eq("id", id)
      .single<EventDetail>(),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id),
    supabase.auth.getUser(),
  ]);

  if (!event) notFound();

  // Determine if we should show the registration form
  let captainTeams: TeamOption[] = [];
  let alreadyRegisteredTeamIds: string[] = [];

  if (user && event.status !== "finished") {
    const { data: myTeams } = await supabase
      .from("teams")
      .select("id, name")
      .eq("captain_id", user.id);

    captainTeams = (myTeams ?? []) as TeamOption[];

    if (captainTeams.length > 0) {
      const teamIds = captainTeams.map((t) => t.id);
      const { data: existingRegs } = await supabase
        .from("registrations")
        .select("team_id")
        .eq("event_id", id)
        .in("team_id", teamIds);

      alreadyRegisteredTeamIds = (existingRegs ?? []).map((r) => r.team_id as string);
    }
  }

  const eligibleTeams = captainTeams.filter((t) => !alreadyRegisteredTeamIds.includes(t.id));
  const allTeamsAlreadyRegistered =
    captainTeams.length > 0 && eligibleTeams.length === 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10 lg:px-10">

        {/* Back */}
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
        >
          ← Todos os eventos
        </Link>

        {/* Event header */}
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-amber-400/4 blur-3xl"
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <StatusBadge status={event.status} />
              <h1 className="text-3xl font-bold text-white lg:text-4xl">{event.title}</h1>
            </div>
            {event.prize_pool > 0 ? (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-6 py-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-300/70">
                  Premiação
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-300">
                  {fmtMoney.format(event.prize_pool)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Início: {fmt.format(new Date(event.start_date))}
            </span>
            {event.end_date ? (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Fim: {fmt.format(new Date(event.end_date))}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {registrationCount ?? 0} equipe{(registrationCount ?? 0) !== 1 ? "s" : ""} inscrita{(registrationCount ?? 0) !== 1 ? "s" : ""}
            </span>
            <Link href={`/events/${event.id}/bracket`} className="font-medium text-cyan-300 hover:text-cyan-200">
              Ver chaveamento →
            </Link>
          </div>

          {event.description ? (
            <p className="mt-5 text-sm leading-7 text-slate-300">{event.description}</p>
          ) : null}
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          {/* Rules */}
          <div className="space-y-6">
            {event.rules ? (
              <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  Regras do Torneio
                </h2>
                <div className="prose prose-sm prose-invert mt-4 max-w-none text-slate-300">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-7">
                    {event.rules}
                  </pre>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Trophy className="h-5 w-5 text-amber-400" />
                Premiação e Detalhes
              </h2>
              <Link
                href={`/events/${event.id}/bracket`}
                className="mt-3 inline-flex text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                Acessar chaveamento completo
              </Link>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-white/6 pb-3">
                  <dt className="text-slate-400">Status</dt>
                  <dd>
                    <StatusBadge status={event.status} />
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-white/6 pb-3">
                  <dt className="text-slate-400">Equipes inscritas</dt>
                  <dd className="font-semibold text-white">{registrationCount ?? 0}</dd>
                </div>
                {event.prize_pool > 0 ? (
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-slate-400">
                      <Coins className="h-3.5 w-3.5" />
                      Pool de premiação
                    </dt>
                    <dd className="font-bold text-amber-300">{fmtMoney.format(event.prize_pool)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>

          {/* Registration sidebar */}
          <aside>
            <div className="sticky top-24 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Scroll className="h-5 w-5 text-amber-400" />
                Inscrição
              </h2>

              {event.status === "finished" ? (
                <p className="mt-4 rounded-xl border border-slate-400/20 bg-slate-400/10 px-4 py-3 text-sm text-slate-400">
                  Este torneio já foi encerrado.
                </p>
              ) : !user ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-slate-400">
                    Faça login para inscrever sua equipe neste torneio.
                  </p>
                  <Link
                    href={`/auth/login?next=/events/${event.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Login com Discord
                  </Link>
                </div>
              ) : captainTeams.length === 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-slate-400">
                    Você precisa ser capitão de uma equipe para se inscrever.
                  </p>
                  <Link
                    href="/teams"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                  >
                    Criar uma equipe
                  </Link>
                </div>
              ) : allTeamsAlreadyRegistered ? (
                <p className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200">
                  {captainTeams.length === 1
                    ? "Sua equipe já está inscrita neste evento."
                    : "Todas as suas equipes já estão inscritas neste evento."}
                </p>
              ) : (
                <div className="mt-4">
                  <RegisterTeamForm eventId={event.id} captainTeams={eligibleTeams} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = cn(
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
    status === "active" && "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    status === "draft" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
    status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-400",
  );
  return <span className={cls}>{STATUS_LABELS[status] ?? status}</span>;
}
