import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Calendar, Scroll, Shield, Trophy } from "lucide-react";

import { RegisterTeamForm } from "@/components/register-team-form";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type EventDetail = {
  id: string;
  title: string;
  name: string;
  description: string | null;
  rules: string | null;
  status: "registrations_open" | "check_in" | "started" | "finished";
  tournament_type: "1v1_elimination" | "free_for_all_points";
  crew_type: "sloop" | "brig" | "galleon";
  start_date: string;
  end_date: string | null;
  registration_deadline: string | null;
  prize: string;
  max_teams: number | null;
  published_at: string | null;
  created_at: string;
  logo_url: string | null;
  banner_url: string | null;
};

type TeamOption = { id: string; name: string; memberCount: number };

const STATUS_LABELS: Record<string, string> = {
  registrations_open: "Inscricoes abertas",
  check_in: "Check-in",
  started: "Em andamento",
  finished: "Finalizado",
};

const TOURNAMENT_TYPE_LABELS = {
  "1v1_elimination": "1v1",
  free_for_all_points: "FFA",
} as const;

const CREW_TYPE_LABELS = {
  sloop: "Sloop",
  brig: "Brig",
  galleon: "Galleon",
} as const;

const CREW_REQUIRED_SIZE: Record<EventDetail["crew_type"], number> = {
  sloop: 2,
  brig: 3,
  galleon: 4,
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
      .select("id, title, name, description, rules, status, tournament_type, crew_type, start_date, end_date, registration_deadline, prize, max_teams, published_at, created_at, logo_url, banner_url")
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
  let incompatibleTeamsCount = 0;
  let registrationSuspension: { reason: string; expiresAt: string | null } | null = null;
  const requiredSize = CREW_REQUIRED_SIZE[event.crew_type];

  if (user && event.status !== "finished") {
    const { data: myTeams } = await supabase
      .from("teams")
      .select("id, name, captain_id")
      .eq("captain_id", user.id);

    const baseTeams = (myTeams ?? []) as Array<{ id: string; name: string; captain_id: string }>;

    if (baseTeams.length > 0) {
      const teamIds = baseTeams.map((team) => team.id);
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds);

      const rosterByTeam = new Map<string, Set<string>>();

      for (const team of baseTeams) {
        rosterByTeam.set(team.id, new Set<string>([team.captain_id]));
      }

      for (const member of members ?? []) {
        const teamId = String(member.team_id);
        const userId = String(member.user_id);
        if (!rosterByTeam.has(teamId)) {
          rosterByTeam.set(teamId, new Set<string>());
        }
        rosterByTeam.get(teamId)?.add(userId);
      }

      captainTeams = baseTeams.map((team) => ({
        id: team.id,
        name: team.name,
        memberCount: rosterByTeam.get(team.id)?.size ?? 1,
      }));
    }

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

  const openForRegistration = event.status === "registrations_open" || event.status === "check_in";
  const slotsFull = Boolean(event.max_teams && (registrationCount ?? 0) >= event.max_teams);
  const eligibleTeams = captainTeams.filter((t) => !alreadyRegisteredTeamIds.includes(t.id) && t.memberCount === requiredSize);
  incompatibleTeamsCount = captainTeams.filter((t) => !alreadyRegisteredTeamIds.includes(t.id) && t.memberCount !== requiredSize).length;
  const allTeamsAlreadyRegistered =
    captainTeams.length > 0 && captainTeams.every((team) => alreadyRegisteredTeamIds.includes(team.id));
  const registrationClosed = Boolean(event.registration_deadline && new Date(event.registration_deadline) < new Date());
  const canRegister = openForRegistration && !slotsFull;

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
              <Image src={event.banner_url} alt={event.title} width={1280} height={320} className="h-52 w-full object-cover" />
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
                {event.logo_url ? <Image src={event.logo_url} alt={event.title} width={56} height={56} className="h-14 w-14 rounded-2xl object-cover" /> : null}
                <h1 className="text-3xl font-bold text-white lg:text-4xl">{event.name || event.title}</h1>
              </div>
            </div>
            {event.prize ? (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-6 py-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-300/70">
                  Premiação
                </p>
                <p className="mt-1 max-w-[220px] text-sm font-semibold text-amber-200">{event.prize}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="Tipo de torneio" value={TOURNAMENT_TYPE_LABELS[event.tournament_type]} />
            <InfoCard label="Tipo de tripulação" value={CREW_TYPE_LABELS[event.crew_type]} />
            <InfoCard label="Equipes inscritas" value={`${registrationCount ?? 0}${event.max_teams ? `/${event.max_teams}` : ""}`} />
          </div>

          {event.description ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Descricao</h2>
              <MarkdownRenderer content={event.description} className="mt-3 text-sm leading-7 text-slate-300" />
            </div>
          ) : null}
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          {/* Regras */}
          <div className="space-y-6">
            {event.rules ? (
              <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  Regras Especificas
                </h2>
                <MarkdownRenderer content={event.rules} className="mt-4 text-sm text-slate-300" />
              </section>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Calendar className="h-5 w-5 text-amber-400" />
                Datas Importantes
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-white/6 pb-3">
                  <dt className="text-slate-400">Inicio das inscricoes</dt>
                  <dd className="font-semibold text-white">{fmt.format(new Date(event.published_at ?? event.created_at))}</dd>
                </div>
                <div className="flex items-center justify-between border-b border-white/6 pb-3">
                  <dt className="text-slate-400">Limite de inscricao</dt>
                  <dd className="font-semibold text-white">
                    {event.registration_deadline ? fmt.format(new Date(event.registration_deadline)) : "Nao definido"}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-white/6 pb-3">
                  <dt className="text-slate-400">Data de inicio</dt>
                  <dd className="font-semibold text-white">{fmt.format(new Date(event.start_date))}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Data de termino</dt>
                  <dd className="font-semibold text-white">
                    {event.end_date ? fmt.format(new Date(event.end_date)) : "Nao definido"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Trophy className="h-5 w-5 text-amber-400" />
                Equipes Inscritas
              </h2>
              <p className="mt-3 text-sm text-slate-300">
                {registrationCount ?? 0} equipe{(registrationCount ?? 0) !== 1 ? "s" : ""}
                {event.max_teams ? ` de ${event.max_teams} vagas preenchidas` : " inscrita" + ((registrationCount ?? 0) !== 1 ? "s" : "")}
              </p>
              <Link
                href={`/events/${event.id}/bracket`}
                className="mt-3 inline-flex text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                Ver chaveamento completo →
              </Link>
            </section>
          </div>

          {/* Barra lateral de inscrição */}
          <aside id="inscricao">
            <div className="sticky top-24 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Scroll className="h-5 w-5 text-amber-400" />
                Inscrição
              </h2>

              {event.status === "finished" ? (
                <p className="mt-4 rounded-xl border border-slate-400/20 bg-slate-400/10 px-4 py-3 text-sm text-slate-400">
                  Este torneio já foi encerrado.
                </p>
              ) : !canRegister ? (
                <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  As inscricoes nao estao abertas neste momento.
                </p>
              ) : slotsFull ? (
                <p className="mt-4 rounded-xl border border-slate-400/20 bg-slate-400/10 px-4 py-3 text-sm text-slate-300">
                  Todas as vagas de inscricao foram preenchidas.
                </p>
              ) : registrationClosed ? (
                <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                  O prazo de inscricoes ja foi encerrado.
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
                  Sua conta esta suspensa para inscricoes em torneios.
                  {registrationSuspension.expiresAt
                    ? ` Expira em ${fmt.format(new Date(registrationSuspension.expiresAt))}.`
                    : " Suspensao sem prazo definido."}
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
                    ? "Sua equipe ja esta inscrita neste evento."
                    : "Todas as suas equipes ja estao inscritas neste evento."}
                </p>
              ) : incompatibleTeamsCount > 0 && eligibleTeams.length === 0 ? (
                <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  Nenhuma das suas equipes possui a tripulacao exigida para este torneio ({CREW_TYPE_LABELS[event.crew_type]} com {requiredSize} jogadores).
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
    status === "registrations_open" && "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    status === "check_in" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
    status === "started" && "border border-sky-400/30 bg-sky-400/10 text-sky-300",
    status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-400",
  );
  return <span className={cls}>{STATUS_LABELS[status] ?? status}</span>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
