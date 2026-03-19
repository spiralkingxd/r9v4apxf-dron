import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Coins, Scroll, Shield, Trophy, Users } from "lucide-react";

import { RegisterTeamForm } from "@/components/register-team-form";
import { formatTeamSize } from "@/lib/events";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  status: "draft" | "published" | "active" | "paused" | "finished";
  start_date: string;
  end_date: string | null;
  registration_deadline: string | null;
  prize_description: string | null;
  team_size: number;
  logo_url: string | null;
  banner_url: string | null;
};

type TeamOption = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  draft: "Rascunho",
  published: "Publicado",
  paused: "Pausado",
  finished: "Finalizado",
};

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" });

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
      .select("id, title, description, rules, status, start_date, end_date, registration_deadline, prize_description, team_size, logo_url, banner_url")
      .eq("id", id)
      .single<EventDetail>(),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("event_id", id),
    supabase.auth.getUser(),
  ]);

  if (!event) notFound();

  // Define qual estado da inscrição deve ser exibido ao usuário.
  let captainTeams: TeamOption[] = [];
  let alreadyRegisteredTeamIds: string[] = [];
  let registrationSuspension: { reason: string; expiresAt: string | null } | null = null;

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

    const nowIso = new Date().toISOString();
    const { data: activeRestriction } = await supabase
      .from("bans")
      .select("reason, expires_at")
      .eq("user_id", user.id)
      .eq("scope", "tournament_registration")
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ reason: string; expires_at: string | null }>();

    if (activeRestriction) {
      registrationSuspension = {
        reason: String(activeRestriction.reason),
        expiresAt: activeRestriction.expires_at ? String(activeRestriction.expires_at) : null,
      };
    }
  }

  const eligibleTeams = captainTeams.filter((t) => !alreadyRegisteredTeamIds.includes(t.id));
  const allTeamsAlreadyRegistered =
    captainTeams.length > 0 && eligibleTeams.length === 0;
  const registrationClosed = Boolean(event.registration_deadline && new Date(event.registration_deadline) < new Date());
  const canRegister = event.status === "published" || event.status === "active";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10 lg:px-10">

        {/* Voltar */}
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
        >
          ← Todos os eventos
        </Link>

        {/* Event header */}
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-8">
          {event.banner_url ? (
            <div className="mb-6 overflow-hidden rounded-2xl border border-white/10">
              <img src={event.banner_url} alt={event.title} className="h-52 w-full object-cover" />
            </div>
          ) : null}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-amber-400/4 blur-3xl"
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <StatusBadge status={event.status} />
              <div className="flex items-center gap-3">
                {event.logo_url ? <img src={event.logo_url} alt={event.title} className="h-14 w-14 rounded-2xl object-cover" /> : null}
                <h1 className="text-3xl font-bold text-white lg:text-4xl">{event.title}</h1>
              </div>
            </div>
            {event.prize_description ? (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-6 py-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-300/70">
                  Premiação
                </p>
                <p className="mt-1 max-w-[220px] text-sm font-semibold text-amber-200">{event.prize_description}</p>
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
            {event.registration_deadline ? (
              <span className="flex items-center gap-1.5">
                <Scroll className="h-4 w-4" />
                Inscrições até {fmt.format(new Date(event.registration_deadline))}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {registrationCount ?? 0} equipe{(registrationCount ?? 0) !== 1 ? "s" : ""} inscrita{(registrationCount ?? 0) !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
              {formatTeamSize(event.team_size)}
            </span>
            <Link href={`/events/${event.id}/bracket`} className="font-medium text-cyan-300 hover:text-cyan-200">
              Ver chaveamento →
            </Link>
          </div>

          {event.description ? (
            <div className="prose prose-invert mt-5 max-w-none text-sm leading-7 text-slate-300" dangerouslySetInnerHTML={{ __html: event.description }} />
          ) : null}
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          {/* Regras */}
          <div className="space-y-6">
            {event.rules ? (
              <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  Regras do Torneio
                </h2>
                <div className="prose prose-sm prose-invert mt-4 max-w-none text-slate-300" dangerouslySetInnerHTML={{ __html: event.rules }} />
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
                {event.prize_description ? (
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-slate-400">
                      <Coins className="h-3.5 w-3.5" />
                      Premiação
                    </dt>
                    <dd className="max-w-[200px] text-right font-bold text-amber-300">{event.prize_description}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>

          {/* Barra lateral de inscrição */}
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
              ) : event.status === "paused" ? (
                <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  As inscrições estão temporariamente pausadas pela organização.
                </p>
              ) : !canRegister ? (
                <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  O evento ainda não foi publicado para inscrições.
                </p>
              ) : registrationClosed ? (
                <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                  O prazo de inscrições já foi encerrado.
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
              ) : registrationSuspension ? (
                <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                  Sua conta está suspensa para inscrições em torneios.
                  {registrationSuspension.expiresAt
                    ? ` Expira em ${fmt.format(new Date(registrationSuspension.expiresAt))}.`
                    : " Suspensão sem prazo definido."}
                  {` Motivo: ${registrationSuspension.reason}`}
                </p>
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
    status === "draft" && "border border-slate-400/20 bg-slate-400/10 text-slate-300",
    status === "published" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
    status === "paused" && "border border-rose-400/30 bg-rose-400/10 text-rose-300",
    status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-400",
  );
  return <span className={cls}>{STATUS_LABELS[status] ?? status}</span>;
}
