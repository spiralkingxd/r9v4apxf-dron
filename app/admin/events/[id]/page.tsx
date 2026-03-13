import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowLeft, CalendarDays, ClipboardList, Flag, ListChecks, Swords, Trophy } from "lucide-react";

import { getAdminEventDetail } from "@/app/admin/events/_data";
import { AdminBadge } from "@/components/admin/admin-badge";
import { EventDetailAdminActions } from "@/components/admin/event-detail-admin-actions";
import {
  formatEventStatus,
  formatEventType,
  formatEventVisibility,
  formatTeamSize,
  formatTournamentFormat,
} from "@/lib/events";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type TabKey = "info" | "registrations" | "matches" | "results" | "logs";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminEventDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const tabRaw = firstValue(query.tab);
  const tab = (tabRaw === "registrations" || tabRaw === "matches" || tabRaw === "results" || tabRaw === "logs" ? tabRaw : "info") as TabKey;

  const { event, counts, matches, logs } = await getAdminEventDetail(id);

  const tabs: Array<{ key: TabKey; label: string; icon: ComponentType<{ className?: string }> }> = [
    { key: "info", label: "Informações", icon: Flag },
    { key: "registrations", label: "Inscrições", icon: ClipboardList },
    { key: "matches", label: "Partidas", icon: Swords },
    { key: "results", label: "Resultados", icon: Trophy },
    { key: "logs", label: "Logs", icon: ListChecks },
  ];

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <Link href="/admin/events" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Voltar para eventos
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin Event Center</p>
            <h1 className="mt-1 text-2xl font-bold text-white">{event.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <AdminBadge tone="info">{formatEventStatus(event.status)}</AdminBadge>
              <AdminBadge tone="pending">{formatEventType(event.event_type)}</AdminBadge>
              <AdminBadge tone="inactive">{formatEventVisibility(event.visibility)}</AdminBadge>
              <AdminBadge tone="active">{formatTeamSize(event.team_size)}</AdminBadge>
              {event.tournament_format ? <AdminBadge tone="info">{formatTournamentFormat(event.tournament_format)}</AdminBadge> : null}
            </div>
          </div>

          <EventDetailAdminActions eventId={id} status={event.status} />
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3 lg:grid-cols-6">
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">Aprovadas: {counts.registrationsApproved}</p>
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">Pendentes: {counts.registrationsPending}</p>
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">Rejeitadas: {counts.registrationsRejected}</p>
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">Partidas: {counts.matchesTotal}</p>
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">Finalizadas: {counts.matchesFinished}</p>
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">Atualizado: {dateFmt.format(new Date(event.updated_at))}</p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
        {tabs.map((item) => {
          const active = tab === item.key;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={`/admin/events/${id}?tab=${item.key}`}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "info" ? (
        <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-6 lg:grid-cols-2">
          <article className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Agenda</h2>
            <p className="text-sm text-slate-200">Início: {dateFmt.format(new Date(event.start_date))}</p>
            <p className="text-sm text-slate-200">Fim: {event.end_date ? dateFmt.format(new Date(event.end_date)) : "-"}</p>
            <p className="text-sm text-slate-200">Limite de inscrições: {event.registration_deadline ? dateFmt.format(new Date(event.registration_deadline)) : "-"}</p>
            {event.max_teams ? <p className="text-sm text-slate-200">Máximo de equipes: {event.max_teams}</p> : null}
          </article>

          <article className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Descrição</h2>
            <p className="text-sm leading-relaxed text-slate-200">{event.description?.trim() ? event.description : "Sem descrição cadastrada."}</p>
            <p className="text-xs text-slate-500">Criado em {dateFmt.format(new Date(event.created_at))}</p>
          </article>
        </section>
      ) : null}

      {tab === "registrations" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Inscrições</h2>
            <Link href={`/admin/events/${id}/registrations`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
              Abrir gerenciamento completo
            </Link>
          </div>
          <p className="text-sm text-slate-300">Total de inscrições: {counts.registrationsTotal}. Pendências: {counts.registrationsPending}.</p>
        </section>
      ) : null}

      {tab === "matches" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Partidas vinculadas</h2>
            <Link href={`/admin/matches?eventId=${id}`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
              Abrir módulo de partidas
            </Link>
          </div>
          <ul className="space-y-2">
            {matches.slice(0, 12).map((match) => (
              <li key={match.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                <span className="font-semibold">R{match.round}</span> - {match.team_a_name} {match.score_a} x {match.score_b} {match.team_b_name} ({match.status})
              </li>
            ))}
            {matches.length === 0 ? <li className="text-sm text-slate-500">Nenhuma partida cadastrada.</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "results" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Resultados</h2>
            <Link href={`/admin/results?eventId=${id}`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
              Abrir módulo de resultados
            </Link>
          </div>
          <ul className="space-y-2">
            {matches.filter((row) => row.status === "finished").slice(0, 12).map((match) => (
              <li key={match.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                {match.team_a_name} {match.score_a} x {match.score_b} {match.team_b_name} - vencedor: {match.winner_name}
              </li>
            ))}
            {matches.every((row) => row.status !== "finished") ? <li className="text-sm text-slate-500">Ainda não há resultados finalizados.</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "logs" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">Logs administrativos</h2>
          <ul className="space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                <p className="font-semibold text-slate-100">{log.action}</p>
                <p className="text-xs text-slate-400">{dateFmt.format(new Date(log.created_at))} por {log.admin_name}</p>
              </li>
            ))}
            {logs.length === 0 ? <li className="text-sm text-slate-500">Sem logs para este evento.</li> : null}
          </ul>
        </section>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarDays className="h-4 w-4" />
        Use as abas para navegar entre informações, inscrições, partidas, resultados e trilha de auditoria.
      </div>
    </section>
  );
}
