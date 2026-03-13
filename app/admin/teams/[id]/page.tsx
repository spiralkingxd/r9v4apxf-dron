import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Gamepad2, Shield, Users } from "lucide-react";

import { getTeamDetails } from "@/app/admin/team-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { TeamDetailAdminActions } from "@/components/admin/team-detail-admin-actions";
import { TeamDetailMemberActions } from "@/components/admin/team-detail-member-actions";

type Props = { params: Promise<{ id: string }> };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminTeamDetailPage({ params }: Props) {
  const { id } = await params;
  const { data, error } = await getTeamDetails(id);

  if (!data) {
    if (!error?.length) notFound();
    return (
      <section className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-6 text-sm text-rose-100">
        {error}
      </section>
    );
  }

  const { team, members, stats, history, registrations, availableUsers } = data;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <Link href="/admin/teams" className="text-sm text-cyan-200 hover:text-cyan-100">
          Voltar para equipes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{team.name}</h1>
        <p className="text-sm text-slate-400">
          Capitão: <Link href={`/profile/${team.captain_id}`} className="text-cyan-200 hover:text-cyan-100">{team.captain_name}</Link> · Criada em {dateFmt.format(new Date(team.created_at))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {team.status === "dissolved" ? <AdminBadge tone="inactive">⚫ Dissolvida</AdminBadge> : null}
          {team.status === "empty" ? <AdminBadge tone="danger">🔴 Vazia</AdminBadge> : null}
          {team.status === "incomplete" ? <AdminBadge tone="pending">🟡 Incompleta</AdminBadge> : null}
          {team.status === "active" ? <AdminBadge tone="active">🟢 Ativa</AdminBadge> : null}
        </div>
        <div className="mt-4">
          <TeamDetailAdminActions
            teamId={team.id}
            teamName={team.name}
            currentName={team.name}
            currentLogoUrl={team.logo_url}
            isDissolved={Boolean(team.dissolved_at)}
            members={members.map((member) => ({
              id: member.user_id,
              display_name: member.display_name,
              username: member.username,
              isCaptain: member.user_id === team.captain_id,
            }))}
            availableUsers={availableUsers}
          />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Informações</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            <li>Membros: {team.member_count}/{team.max_members}</li>
            <li>Última atividade: {stats.latest_activity_at ? dateFmt.format(new Date(stats.latest_activity_at)) : "-"}</li>
            <li>Dissolvida em: {team.dissolved_at ? dateFmt.format(new Date(team.dissolved_at)) : "-"}</li>
            <li>Motivo da dissolução: {team.dissolve_reason ?? "-"}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 lg:col-span-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Gamepad2 className="h-4 w-4" />
            Membros da equipe
          </h2>
          <ul className="mt-3 space-y-2">
            {members.map((member) => (
              <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-100">{member.display_name}</p>
                  <p className="text-xs text-slate-400">
                    @{member.username} · Xbox: {member.xbox_gamertag ?? "-"} · Entrada: {dateFmt.format(new Date(member.joined_at))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AdminBadge tone={member.user_id === team.captain_id ? "active" : "inactive"}>
                    {member.user_id === team.captain_id ? "Capitão" : "Membro"}
                  </AdminBadge>
                  <TeamDetailMemberActions
                    teamId={team.id}
                    userId={member.user_id}
                    isCaptain={member.user_id === team.captain_id}
                    displayName={member.display_name}
                  />
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Shield className="h-4 w-4" />
            Estatísticas
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            <li>Torneios inscritos: {stats.tournaments}</li>
            <li>Partidas jogadas: {stats.matches_played}</li>
            <li>Vitórias / Derrotas: {stats.wins} / {stats.losses}</li>
            <li>Partidas pendentes: {stats.pending_matches}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Calendar className="h-4 w-4" />
            Torneios participados
          </h2>
          <ul className="mt-3 space-y-2">
            {registrations.map((item) => (
              <li key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-slate-200">
                <p>{item.event_title}</p>
                <p className="text-xs text-slate-400">{item.status} · {dateFmt.format(new Date(item.created_at))}</p>
              </li>
            ))}
            {registrations.length === 0 ? <li className="text-sm text-slate-500">Sem inscrições registradas.</li> : null}
          </ul>
        </article>
      </div>

      <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
          <Users className="h-4 w-4" />
          Histórico da equipe
        </h2>
        <ul className="mt-3 space-y-2">
          {history.map((log) => (
            <li key={`${log.source}-${log.id}`} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
              <p className="font-semibold">{log.action}</p>
              <p>{dateFmt.format(new Date(log.created_at))}</p>
              <p className="text-slate-500">{log.details ? JSON.stringify(log.details) : "-"}</p>
            </li>
          ))}
          {history.length === 0 ? <li className="text-sm text-slate-500">Sem histórico de mudanças.</li> : null}
        </ul>
      </article>
    </section>
  );
}
