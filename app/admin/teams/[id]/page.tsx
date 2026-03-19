import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Gamepad2, Shield, Users } from "lucide-react";

import { decideJoinRequestAsAdmin, getTeamDetails } from "@/app/admin/team-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { TeamDetailAdminActions } from "@/components/admin/team-detail-admin-actions";
import { TeamDetailMemberActions } from "@/components/admin/team-detail-member-actions";

type Props = { params: Promise<{ id: string }> };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

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

  const { team, members, stats, history, registrations, availableUsers, joinRequests } = data;

  async function handleRequestAction(formData: FormData) {
    "use server";
    const requestId = String(formData.get("request_id") ?? "");
    const decision = String(formData.get("decision") ?? "") as "approved" | "rejected";
    if (!requestId || (decision !== "approved" && decision !== "rejected")) return;
    await decideJoinRequestAsAdmin(requestId, decision);
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-6">
        <Link href="/admin/teams" className="text-sm text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
          Voltar para equipes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{team.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Capitão: <Link href={`/profile/${team.captain_id}`} className="text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">{team.captain_name}</Link> · Criada em {dateFmt.format(new Date(team.created_at))}
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
        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Informações</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>Membros: {team.member_count}/{team.max_members}</li>
            <li>Última atividade: {stats.latest_activity_at ? dateFmt.format(new Date(stats.latest_activity_at)) : "-"}</li>
            <li>Dissolvida em: {team.dissolved_at ? dateFmt.format(new Date(team.dissolved_at)) : "-"}</li>
            <li>Motivo da dissolução: {team.dissolve_reason ?? "-"}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5 lg:col-span-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Gamepad2 className="h-4 w-4" />
            Membros da equipe
          </h2>
          <ul className="mt-3 space-y-2">
            {members.map((member) => (
              <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{member.display_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
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
        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Shield className="h-4 w-4" />
            Estatísticas
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>Torneios inscritos: {stats.tournaments}</li>
            <li>Partidas jogadas: {stats.matches_played}</li>
            <li>Vitórias / Derrotas: {stats.wins} / {stats.losses}</li>
            <li>Partidas pendentes: {stats.pending_matches}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Calendar className="h-4 w-4" />
            Torneios participados
          </h2>
          <ul className="mt-3 space-y-2">
            {registrations.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 p-2 text-sm text-slate-700 dark:text-slate-200">
                <p>{item.event_title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.status} · {dateFmt.format(new Date(item.created_at))}</p>
              </li>
            ))}
            {registrations.length === 0 ? <li className="text-sm text-slate-500">Sem inscrições registradas.</li> : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Users className="h-4 w-4" />
            Solicitacoes de entrada
          </h2>
          <ul className="mt-3 space-y-2">
            {joinRequests.filter((request) => request.status === "pending").map((request) => (
              <li key={request.id} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 p-3">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{request.display_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  @{request.username} | Xbox: {request.xbox_gamertag ?? "-"} | {dateFmt.format(new Date(request.created_at))}
                </p>
                <div className="mt-2 flex gap-2">
                  <form action={handleRequestAction}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button type="submit" className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-300/20">
                      Aprovar
                    </button>
                  </form>
                  <form action={handleRequestAction}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button type="submit" className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-xs text-rose-100 hover:bg-rose-300/20">
                      Recusar
                    </button>
                  </form>
                </div>
              </li>
            ))}
            {joinRequests.filter((request) => request.status === "pending").length === 0 ? (
              <li className="text-sm text-slate-500">Sem solicitacoes pendentes.</li>
            ) : null}
          </ul>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
          <Users className="h-4 w-4" />
          Histórico da equipe
        </h2>
        <ul className="mt-3 space-y-2">
          {history.map((log) => (
            <li key={`${log.source}-${log.id}`} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 p-2 text-xs text-slate-600 dark:text-slate-300">
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
