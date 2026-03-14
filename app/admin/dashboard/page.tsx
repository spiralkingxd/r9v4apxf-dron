import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  Ban,
  Clock3,
  Gamepad2,
  Shield,
  ShieldAlert,
  Swords,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import { getDashboardStats, getMonthlyTeams, getRecentActivity, getSystemAlerts, getWeeklyUsers } from "@/app/admin/dashboard/actions";
import { ActivityItem } from "@/components/admin/activity-item";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AlertBanner } from "@/components/admin/alert-banner";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { DashboardExportButton } from "@/components/admin/dashboard-export-button";

import { createClient } from "@/lib/supabase/server";

const DashboardCharts = dynamic(
  () => import("@/components/admin/dashboard-charts").then((mod) => mod.DashboardCharts),
  {
    loading: () => (
      <section className="admin-surface rounded-2xl p-6">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-xl bg-white/5 lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-xl bg-white/5" />
          <div className="h-72 animate-pulse rounded-xl bg-white/5 lg:col-span-3" />
        </div>
      </section>
    ),
  },
);

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });
const numberFmt = new Intl.NumberFormat("pt-BR");

function getGreetingLabel(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function AdminDashboardPage() {
  const now = new Date();
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let displayName = "Admin";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();
    
    if (profile) {
      displayName = profile.display_name || profile.username || "Admin";
    }
  }

  const [statsPayload, weeklyUsers, monthlyTeams, activity, alerts] = await Promise.all([
    getDashboardStats(),
    getWeeklyUsers(),
    getMonthlyTeams(),
    getRecentActivity(5),
    getSystemAlerts(),
  ]);

  const totalAlerts =
    alerts.lowMemberTeams.length +
    alerts.staleJoinRequests48h.length +
    alerts.staleMatches72h.length +
    alerts.potentialMultiAccounts.length;

  const statCards = [
    {
      label: "Total de Usuarios",
      value: numberFmt.format(statsPayload.stats.totalUsers),
      helper: `+${numberFmt.format(statsPayload.stats.newUsersThisMonth)} novos este mes`,
      icon: <Users className="h-5 w-5" />,
      tone: "info" as const,
    },
    {
      label: "Total de Equipes",
      value: numberFmt.format(statsPayload.stats.totalTeams),
      helper: `${numberFmt.format(statsPayload.stats.activeTeams)} equipes ativas`,
      icon: <Shield className="h-5 w-5" />,
      tone: "success" as const,
    },
    {
      label: "Torneios Ativos",
      value: numberFmt.format(statsPayload.stats.activeTournaments),
      helper: "Em disputa",
      icon: <Trophy className="h-5 w-5" />,
      tone: "warning" as const,
    },
    {
      label: "Partidas Hoje",
      value: numberFmt.format(statsPayload.stats.matchesToday),
      helper: "Agendadas",
      icon: <Swords className="h-5 w-5" />,
      tone: "info" as const,
    },
    {
      label: "Usuarios Banidos",
      value: numberFmt.format(statsPayload.stats.bannedUsers),
      helper: "Requer atencao",
      icon: <Ban className="h-5 w-5" />,
      tone: "danger" as const,
    },
    {
      label: "Solicitacoes Pendentes",
      value: numberFmt.format(statsPayload.stats.pendingJoinRequests),
      helper: "Aguardando aprovacao",
      icon: <Clock3 className="h-5 w-5" />,
      tone: "warning" as const,
    },
  ];

  return (
    <section className="space-y-6">
      <header className="admin-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Painel Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-[color:var(--text-strong)]">{getGreetingLabel(now)}, @{displayName}</h1>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">{dateFmt.format(now)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={totalAlerts > 0 ? "pending" : "active"}>
              {totalAlerts > 0 ? `${numberFmt.format(totalAlerts)} alertas ativos` : "Sistema estavel"}
            </AdminBadge>
            <DashboardExportButton type="overview" />
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((card, index) => (
          <AdminStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            icon={card.icon}
            tone={card.tone}
            delayMs={index * 60}
          />
        ))}
      </div>

      <DashboardCharts weeklyUsers={weeklyUsers} monthlyTeams={monthlyTeams} tournamentStatus={statsPayload.tournamentStatus} />

      <section className="admin-surface space-y-4 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Alertas do Sistema</h2>
          <Link href="/admin/teams" className="text-xs uppercase tracking-[0.14em] text-cyan-300 hover:text-cyan-200">
            Abrir gerenciamento
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <AlertBanner
            severity={alerts.lowMemberTeams.length > 0 ? "warning" : "info"}
            title="Equipes com menos de 2 membros"
            description={
              alerts.lowMemberTeams.length > 0
                ? `${numberFmt.format(alerts.lowMemberTeams.length)} equipes abaixo do minimo competitivo.`
                : "Nenhuma equipe abaixo de 2 membros."
            }
            action={
              <Link href="/admin/teams" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Ver equipes
              </Link>
            }
          />

          <AlertBanner
            severity={alerts.staleJoinRequests48h.length > 0 ? "warning" : "info"}
            title="Solicitacoes pendentes ha mais de 48h"
            description={
              alerts.staleJoinRequests48h.length > 0
                ? `${numberFmt.format(alerts.staleJoinRequests48h.length)} solicitacoes precisam de resposta.`
                : "Sem solicitacoes antigas pendentes."
            }
            action={
              <Link href="/admin/teams" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Revisar
              </Link>
            }
          />

          <AlertBanner
            severity={alerts.staleMatches72h.length > 0 ? "error" : "info"}
            title="Partidas sem resultado ha mais de 72h"
            description={
              alerts.staleMatches72h.length > 0
                ? `${numberFmt.format(alerts.staleMatches72h.length)} partidas pendentes de fechamento.`
                : "Nenhuma partida atrasada identificada."
            }
            action={
              <Link href="/admin/matches" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Abrir partidas
              </Link>
            }
          />

          <AlertBanner
            severity={alerts.potentialMultiAccounts.length > 0 ? "warning" : "info"}
            title="Possiveis contas duplicadas"
            description={
              alerts.potentialMultiAccounts.length > 0
                ? `${numberFmt.format(alerts.potentialMultiAccounts.length)} emails com mais de uma conta associada.`
                : "Nenhum indicio relevante de contas duplicadas."
            }
            action={
              <Link href="/admin/members" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Auditar usuarios
              </Link>
            }
          />
        </div>
      </section>

      <section className="admin-surface space-y-4 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Atividades Recentes</h2>
          <Link href="/admin/logs" className="text-xs uppercase tracking-[0.14em] text-cyan-300 hover:text-cyan-200">
            Ver trilha completa
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="admin-surface-muted space-y-2 rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Ultimos 5 usuarios cadastrados</p>
            <div className="space-y-2">
              {activity.latestUsers.length > 0 ? (
                activity.latestUsers.map((item) => (
                  <ActivityItem key={item.id} icon={<UserPlus className="h-4 w-4" />} title={item.title} createdAt={item.createdAt} href={item.href} />
                ))
              ) : (
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">Sem registros.</p>
              )}
            </div>
          </div>

          <div className="admin-surface-muted space-y-2 rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Ultimas 3 equipes criadas</p>
            <div className="space-y-2">
              {activity.latestTeams.length > 0 ? (
                activity.latestTeams.map((item) => (
                  <ActivityItem key={item.id} icon={<Shield className="h-4 w-4" />} title={item.title} createdAt={item.createdAt} href={item.href} />
                ))
              ) : (
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">Sem registros.</p>
              )}
            </div>
          </div>

          <div className="admin-surface-muted space-y-2 rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Ultimas 5 acoes administrativas</p>
            <div className="space-y-2">
              {activity.latestAdminActions.length > 0 ? (
                activity.latestAdminActions.map((item) => (
                  <ActivityItem key={item.id} icon={<AlertCircle className="h-4 w-4" />} title={item.title} createdAt={item.createdAt} href={item.href} />
                ))
              ) : (
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">Sem registros.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="admin-surface rounded-2xl p-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/tournaments/new">
            <AdminButton type="button">
              <Trophy className="h-4 w-4" />
              Novo torneio
            </AdminButton>
          </Link>
          <Link href="/admin/matches">
            <AdminButton type="button" variant="ghost">
              <Gamepad2 className="h-4 w-4" />
              Gerenciar partidas
            </AdminButton>
          </Link>
          <Link href="/admin/teams">
            <AdminButton type="button" variant="ghost">
              <ShieldAlert className="h-4 w-4" />
              Revisar solicitacoes
            </AdminButton>
          </Link>
        </div>
      </section>
    </section>
  );
}
