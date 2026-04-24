import Link from "next/link";
import { Calendar, Coins, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type TournamentStatus = "registrations_open" | "check_in" | "started" | "finished";
type TournamentType = "1v1_elimination" | "free_for_all_points" | "tdm";
type CrewType = "solo_sloop" | "sloop" | "brig" | "galleon";

export type TournamentCardData = {
  id: string;
  title: string;
  name: string;
  status: TournamentStatus;
  tournament_type: TournamentType;
  crew_type: CrewType;
  prize: string;
  start_date: string;
  registration_deadline: string | null;
  max_teams: number | null;
  approved_count: number;
};

type Props = {
  event: TournamentCardData;
};

const STATUS_LABELS: Record<TournamentStatus, string> = {
  registrations_open: "Inscricoes abertas",
  check_in: "Check-in",
  started: "Em andamento",
  finished: "Finalizado",
};

const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  "1v1_elimination": "1v1",
  free_for_all_points: "Modo Arena FFA",
  tdm: "Modo TDM",
};

const CREW_TYPE_LABELS: Record<CrewType, string> = {
  solo_sloop: "Sloop (1 Jogador)",
  sloop: "Sloop",
  brig: "Brig",
  galleon: "Galleon",
};

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium" });

function isRegistrationOpen(event: TournamentCardData) {
  if (event.status !== "registrations_open" && event.status !== "check_in") return false;

  if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
    return false;
  }

  if (event.max_teams && event.approved_count >= event.max_teams) {
    return false;
  }

  return true;
}

function StatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        status === "registrations_open" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        status === "check_in" && "border-amber-400/30 bg-amber-400/10 text-amber-300",
        status === "started" && "border-sky-400/30 bg-sky-400/10 text-sky-300",
        status === "finished" && "border-slate-500/30 bg-slate-500/10 text-slate-300",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TournamentCard({ event }: Props) {
  const registrationOpen = isRegistrationOpen(event);
  const slotsLabel = event.max_teams ? `${event.approved_count}/${event.max_teams}` : `${event.approved_count}/-`;

  return (
    <article className="glass-card soft-ring flex h-full flex-col rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold leading-snug text-slate-100">{event.name || event.title}</h2>
        <StatusBadge status={event.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200">
          {TOURNAMENT_TYPE_LABELS[event.tournament_type]}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200">
          {CREW_TYPE_LABELS[event.crew_type]}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-400">
        <p className="flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-amber-300/80" />
          <span>{event.prize}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>Inicio: {fmt.format(new Date(event.start_date))}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>Vagas: {slotsLabel} equipes inscritas</span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <Link
          href={`/events/${event.id}`}
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
        >
          Ver Detalhes
        </Link>

        {registrationOpen ? (
          <Link
            href={`/events/${event.id}#inscricao`}
            className="inline-flex items-center justify-center rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Inscrever Equipe
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center rounded-xl border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-xs font-medium text-slate-300">
            Inscricoes Encerradas
          </span>
        )}
      </div>
    </article>
  );
}
