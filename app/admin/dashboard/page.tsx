import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import {
  AlertCircle,
  Ban,
  Clock3,
  Shield,
  ShieldAlert,
  Swords,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import {
  getDashboardStats,
  getMonthlyTeams,
  getRecentActivity,
  getSystemAlerts,
  getWeeklyUsers,
} from "@/app/admin/dashboard/actions";
import { ActivityItem } from "@/components/admin/activity-item";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AlertBanner } from "@/components/admin/alert-banner";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { BotAccessCard } from "@/components/admin/bot-access-card";
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

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full" });
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

  // Realizamos apenas uma chamada de cada ação para não sobrecarregar o Supabase.
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
    alerts.potentialMultiAccounts.length +
    alerts.securityAuthFailures15m +
    alerts.criticalAdminActions24h;

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
      label: "Suspensoes Torneio",
      value: numberFmt.format(statsPayload.stats.tournamentSuspensions),
      helper: "Inscricao bloqueada",
      icon: <ShieldAlert className="h-5 w-5" />,
      tone: "warning" as const,
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Alertas do Sistema</h2>
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
              <Link href="/admin/teams" className="text-xs font-semibold text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
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
              <Link href="/admin/teams" className="text-xs font-semibold text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
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
              <Link href="/admin/tournaments" className="text-xs font-semibold text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
                Abrir torneios
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
              <Link href="/admin/members" className="text-xs font-semibold text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
                Auditar usuarios
              </Link>
            }
          />

          <AlertBanner
            severity={alerts.securityAuthFailures15m >= 8 ? "error" : alerts.securityAuthFailures24h > 0 ? "warning" : "info"}
            title="Falhas de autenticação (401/403)"
            description={
              alerts.securityAuthFailures24h > 0
                ? `${numberFmt.format(alerts.securityAuthFailures24h)} falhas nas últimas 24h (${numberFmt.format(alerts.securityAuthFailures15m)} nos últimos 15 min).`
                : "Sem falhas relevantes de autenticação nas últimas 24h."
            }
            action={
              <Link href="/admin/logs" className="text-xs font-semibold text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
                Ver logs
              </Link>
            }
          />

          <AlertBanner
            severity={alerts.criticalAdminActions24h > 0 ? "error" : alerts.suspiciousAdminActions24h > 0 ? "warning" : "info"}
            title="Ações administrativas incomuns"
            description={
              alerts.criticalAdminActions24h > 0 || alerts.suspiciousAdminActions24h > 0
                ? `${numberFmt.format(alerts.criticalAdminActions24h)} críticas e ${numberFmt.format(alerts.suspiciousAdminActions24h)} suspeitas nas últimas 24h.`
                : "Nenhum comportamento administrativo incomum detectado nas últimas 24h."
            }
            action={
              <Link href="/admin/logs" className="text-xs font-semibold text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
                Investigar
              </Link>
            }
          />
        </div>

        {alerts.recentSecurityEvents.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Eventos recentes de segurança</p>
            <div className="mt-3 space-y-2">
              {alerts.recentSecurityEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <span className="text-slate-200">{event.action}</span>
                  <span className="text-xs uppercase tracking-wider text-amber-300">{event.riskLevel}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <section className="admin-surface space-y-4 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Atividades Recentes</h2>
              <Link href="/admin/logs" className="text-xs uppercase tracking-[0.14em] text-cyan-300 hover:text-cyan-200">
            Ver trilha completa
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="admin-surface-muted space-y-2 rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Ultimos 5 usuarios cadastrados</p>
            <div className="space-y-2">
              {activity.latestUsers.length > 0 ? (
                activity.latestUsers.map((item) => (
                  <ActivityItem key={item.id} icon={<UserPlus className="h-4 w-4" />} title={item.title} createdAt={item.createdAt} href={item.href} />
                ))
              ) : (
                <p className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Sem registros.</p>
              )}
            </div>
          </div>

          <div className="admin-surface-muted space-y-2 rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Ultimas 3 equipes criadas</p>
            <div className="space-y-2">
              {activity.latestTeams.length > 0 ? (
                activity.latestTeams.map((item) => (
                  <ActivityItem key={item.id} icon={<Shield className="h-4 w-4" />} title={item.title} createdAt={item.createdAt} href={item.href} />
                ))
              ) : (
                <p className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Sem registros.</p>
              )}
            </div>
          </div>

          <div className="admin-surface-muted space-y-2 rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Ultimas 5 acoes administrativas</p>
            <div className="space-y-2">
              {activity.latestAdminActions.length > 0 ? (
                activity.latestAdminActions.map((item) => (
                  <ActivityItem key={item.id} icon={<AlertCircle className="h-4 w-4" />} title={item.title} createdAt={item.createdAt} href={item.href} />
                ))
              ) : (
                <p className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Sem registros.</p>
              )}
            </div>
          </div>
        </div>
        </section>
      </div>
      <div>
        <BotAccessCard />
      </div>
    </div>

      <section className="admin-surface rounded-2xl p-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/tournaments/new">
            <AdminButton type="button">
              <Trophy className="h-4 w-4" />
              Novo torneio
            </AdminButton>
          </Link>
          <Link href="/admin/teams">
            <AdminButton type="button" variant="ghost">
              <ShieldAlert className="h-4 w-4" />
              Revisar solicitacoes
            </AdminButton>
          </Link>
          <Link href="/admin/notifications#custom-in-app">
            <AdminButton type="button" variant="ghost">
              <AlertCircle className="h-4 w-4" />
              Notificação personalizada
            </AdminButton>
          </Link>
        </div>
      </section>
    </section>
  );
}
