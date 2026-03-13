import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Gamepad2,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminCard } from "@/components/admin/admin-card";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { DashboardExportButton } from "@/components/admin/dashboard-export-button";
import { getAlerts, getDashboardStats, getRecentActivity } from "@/app/admin/dashboard/actions";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ActivityList({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; createdAt: string }>;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <AdminBadge tone="info">Atualizado</AdminBadge>
      </div>
      <ul className="mt-4 space-y-2">
        {items.length === 0 ? (
          <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">Sem registros.</li>
        ) : (
          items.map((item, idx) => (
            <li key={`${item.title}-${idx}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-sm font-medium text-slate-100">{item.title}</p>
              <p className="mt-1 text-xs text-slate-400">{dateFmt.format(new Date(item.createdAt))}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export default async function AdminDashboardPage() {
  const [dashboard, activity, alerts] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(10),
    getAlerts(),
  ]);

  const totalAlerts =
    alerts.lowMemberTeams.length +
    alerts.upcomingTournaments24h.length +
    alerts.staleMatches48h.length +
    alerts.usersWithMultiplePendingRequests.length;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Painel Central</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Dashboard Administrativo</h1>
        <p className="mt-2 text-sm text-slate-400">
          Vis�o operacional completa da plataforma com estat�sticas, alertas e atividades recentes.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard
          label="Total de Usu�rios"
          value={String(dashboard.stats.totalUsers)}
          helper={`${dashboard.stats.activeUsers30d} ativos em 30 dias`}
          icon={<Users className="h-5 w-5" />}
        />
        <AdminCard
          label="Total de Equipes"
          value={String(dashboard.stats.totalTeams)}
          helper={`${dashboard.stats.activeTeams} com 2+ membros`}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <AdminCard
          label="Total de Torneios"
          value={String(dashboard.stats.totalTournaments)}
          helper={`${dashboard.stats.activeTournaments} ativos`}
          icon={<Trophy className="h-5 w-5" />}
        />
        <AdminCard
          label="Partidas Hoje"
          value={String(dashboard.stats.matchesToday)}
          helper={`Receita total: ${moneyFmt.format(dashboard.stats.totalRevenue)}`}
          icon={<Gamepad2 className="h-5 w-5" />}
        />
      </div>

      <DashboardCharts
        registrations30d={dashboard.charts.registrations30d}
        usersByMonth={dashboard.charts.usersByMonth}
        teamsByMonth={dashboard.charts.teamsByMonth}
        tournamentStatus={dashboard.charts.tournamentStatus}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Alertas e Notifica��es</h2>
            <AdminBadge tone={totalAlerts > 0 ? "pending" : "active"}>
              {totalAlerts > 0 ? `${totalAlerts} alertas` : "Sem alertas"}
            </AdminBadge>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Equipes com menos de 2 membros</p>
              <p className="mt-1 text-2xl font-bold text-amber-200">{alerts.lowMemberTeams.length}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {alerts.lowMemberTeams.slice(0, 3).map((team) => (
                  <li key={team.id}>{team.name} ({team.members} membro(s))</li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Torneios nas pr�ximas 24h</p>
              <p className="mt-1 text-2xl font-bold text-cyan-200">{alerts.upcomingTournaments24h.length}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {alerts.upcomingTournaments24h.slice(0, 3).map((event) => (
                  <li key={event.id}>{event.title}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Partidas sem resultado &gt; 48h</p>
              <p className="mt-1 text-2xl font-bold text-rose-200">{alerts.staleMatches48h.length}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {alerts.staleMatches48h.slice(0, 3).map((match) => (
                  <li key={match.id}>Partida {match.id.slice(0, 8)}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Usu�rios com pend�ncias m�ltiplas</p>
              <p className="mt-1 text-2xl font-bold text-fuchsia-200">{alerts.usersWithMultiplePendingRequests.length}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {alerts.usersWithMultiplePendingRequests.slice(0, 3).map((user) => (
                  <li key={user.userId}>{user.name} ({user.pendingRequests} pend�ncias)</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">A��es R�pidas</h2>
          <div className="mt-4 space-y-2">
            <Link href="/admin/tournaments/new" className="block">
              <AdminButton className="w-full justify-start" type="button">
                <CalendarDays className="h-4 w-4" />
                Criar Novo Torneio
              </AdminButton>
            </Link>

            <Link href="/admin/members" className="block">
              <AdminButton className="w-full justify-start" type="button" variant="ghost">
                <UserCheck className="h-4 w-4" />
                Gerenciar Usu�rios
              </AdminButton>
            </Link>

            <Link href="/admin/teams" className="block">
              <AdminButton className="w-full justify-start" type="button" variant="ghost">
                <ClipboardList className="h-4 w-4" />
                Ver Solicita��es Pendentes
              </AdminButton>
            </Link>

            <DashboardExportButton type="overview" />

            <Link href="/admin/dashboard" className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Atualizar Dashboard
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActivityList title="�ltimos 10 logins de usu�rios" items={activity.latestLogins} />
        <ActivityList title="�ltimas 5 equipes criadas" items={activity.latestTeams} />
        <ActivityList title="�ltimos 3 torneios publicados" items={activity.latestPublishedTournaments} />
        <ActivityList title="�ltimas 5 a��es de admin" items={activity.latestAdminActions} />
      </div>
    </section>
  );
}
