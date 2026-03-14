import Link from "next/link";
import { ArrowLeft, Download, Users } from "lucide-react";

import { getEventRegistrations } from "@/app/admin/tournaments/_data";
import { EventRegistrationsTable } from "@/components/admin/event-registrations-table";
import { AdminBadge } from "@/components/admin/admin-badge";
import { formatEventStatus } from "@/lib/events";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminTournamentRegistrationsPage({ params }: Props) {
  const { id } = await params;
  const { event, registrations, availableTeams } = await getEventRegistrations(id, "tournament");
  const approved = registrations.filter((row) => row.status === "approved").length;
  const pending = registrations.filter((row) => row.status === "pending").length;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <Link href="/admin/tournaments" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Voltar para torneios
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Torneio</p>
            <h1 className="mt-1 text-2xl font-bold text-white">{event.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone="info">{formatEventStatus(event.status)}</AdminBadge>
            <Link href={`/admin/tournaments/${id}/registrations/export`} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
              <Download className="h-4 w-4" />
              CSV
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2">
            <Users className="h-4 w-4 text-cyan-300" />
            {approved} aprovadas
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2">
            {pending} pendentes
          </span>
          {event.max_teams ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2">
              Limite: {event.max_teams} equipes
            </span>
          ) : null}
        </div>
      </header>

      <EventRegistrationsTable eventId={id} rows={registrations} availableTeams={availableTeams} />
    </section>
  );
}
