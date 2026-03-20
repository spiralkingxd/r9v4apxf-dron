import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calendar, Shield, Users } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { MemberTeamManagement } from "@/components/admin/MemberTeamManagement";
import { AdminXboxControl } from "@/components/admin/admin-xbox-control";
import { DeleteUserAccountControl } from "@/components/admin/delete-user-account-control";
import { MemberDetailActions } from "@/components/admin/member-detail-actions";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

type TeamItem = {
  id: string;
  name: string;
  logo_url: string | null;
  role: "captain" | "member";
  joined_at: string;
  is_active: boolean;
  max_members: number;
  member_count: number;
};

type RegistrationItem = {
  id: string;
  status: string;
  created_at: string;
  event_title: string;
};

type LogItem = {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

type TeamHistoryItem = {
  id: string;
  action: string;
  created_at: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function AdminMemberDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();

  const { data: adminProfile } = adminUser
    ? await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", adminUser.id)
        .maybeSingle<{ id: string; role: "user" | "admin" | "owner" }>()
    : { data: null as { id: string; role: "user" | "admin" | "owner" } | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, avatar_url, display_name, username, discord_id, xbox_gamertag, email, role, is_banned, created_at, updated_at, banned_reason, ban_reason, banned_at",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      avatar_url: string | null;
      display_name: string | null;
      username: string | null;
      discord_id: string | null;
      xbox_gamertag: string | null;
      email: string | null;
      role: "user" | "admin" | "owner";
      is_banned: boolean;
      created_at: string;
      updated_at: string;
      banned_reason: string | null;
      ban_reason: string | null;
      banned_at: string | null;
    }>();

  if (!profile) notFound();

  const { data: teamsRaw } = await supabase
    .from("team_members")
    .select("team_id, role, joined_at, teams(id, name, logo_url, dissolved_at, max_members)")
    .eq("user_id", id)
    .order("joined_at", { ascending: false });

  const teamsBase: Omit<TeamItem, "member_count">[] = (teamsRaw ?? []).flatMap((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    if (!team) return [];
    return [
      {
        id: team.id as string,
        name: team.name as string,
        logo_url: (team.logo_url as string | null) ?? null,
        role: row.role as "captain" | "member",
        joined_at: row.joined_at as string,
        is_active: !(team.dissolved_at as string | null),
        max_members: Number(team.max_members ?? 10),
      },
    ];
  });

  const currentTeamIds = teamsBase.map((team) => team.id);

  const { data: teamMemberCountsRaw } = currentTeamIds.length
    ? await supabase.from("team_members").select("team_id").in("team_id", currentTeamIds)
    : { data: [] as Array<{ team_id: string }> };

  const teamMemberCounts = new Map<string, number>();
  for (const row of teamMemberCountsRaw ?? []) {
    const teamId = String(row.team_id);
    teamMemberCounts.set(teamId, (teamMemberCounts.get(teamId) ?? 0) + 1);
  }

  const teams: TeamItem[] = teamsBase.map((team) => ({
    ...team,
    member_count: teamMemberCounts.get(team.id) ?? 0,
  }));

  const teamIds = teams.map((team) => team.id);

  const [
    registrationsRawRes,
    logsRawRes,
    matchesPlayedRes,
    winsRes,
    rankingRes,
    loginRawRes,
    availableTeamsRes,
    teamHistoryRes,
  ] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, status, created_at, events(title), teams!inner(team_members!inner(user_id))")
      .eq("team_members.user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("admin_action_logs")
      .select("id, action, created_at, details")
      .or(`and(target_type.eq.profile,target_id.eq.${id}),and(target_type.eq.user,target_id.eq.${id})`)
      .order("created_at", { ascending: false })
      .limit(30),
    teamIds.length
      ? supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .or(`team_a_id.in.(${teamIds.join(",")}),team_b_id.in.(${teamIds.join(",")})`)
      : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null }),
    teamIds.length
      ? supabase.from("matches").select("id", { count: "exact", head: true }).in("winner_id", teamIds)
      : Promise.resolve({ count: 0, error: null } as { count: number | null; error: null }),
    supabase.from("rankings").select("points, wins, losses, rank_position").eq("profile_id", id).maybeSingle(),
    supabase
      .from("admin_logs")
      .select("id, created_at, old_value, new_value")
      .eq("entity_type", "user")
      .eq("entity_id", id)
      .in("action", ["user_login", "admin_login", "owner_login"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("teams")
      .select("id, name, logo_url, max_members, dissolved_at")
      .is("dissolved_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("admin_logs")
      .select("id, action, created_at, old_value, new_value")
      .eq("entity_type", "user")
      .eq("entity_id", id)
      .in("action", ["member_added_to_team", "member_removed_from_team", "member_transferred_team", "team_captain_transferred_member_detail"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const registrationsRaw = registrationsRawRes.data ?? [];
  const logsRaw = logsRawRes.data ?? [];
  const matchesPlayed = matchesPlayedRes.count ?? 0;
  const wins = winsRes.count ?? 0;
  const rankingRaw = rankingRes.data;
  const loginRaw = loginRawRes.data ?? [];
  const availableTeamsRaw = availableTeamsRes.data ?? [];
  const teamHistoryRaw = teamHistoryRes.data ?? [];

  const availableIds = availableTeamsRaw.map((team) => String(team.id));
  const { data: availableMemberRows } = availableIds.length
    ? await supabase.from("team_members").select("team_id").in("team_id", availableIds)
    : { data: [] as Array<{ team_id: string }> };

  const availableCounts = new Map<string, number>();
  for (const row of availableMemberRows ?? []) {
    const teamId = String(row.team_id);
    availableCounts.set(teamId, (availableCounts.get(teamId) ?? 0) + 1);
  }

  const availableTeams = availableTeamsRaw
    .map((team) => {
      const teamId = String(team.id);
      return {
        id: teamId,
        name: String(team.name),
        logo_url: (team.logo_url as string | null) ?? null,
        member_count: availableCounts.get(teamId) ?? 0,
        max_members: Number(team.max_members ?? 10),
      };
    })
    .filter((team) => team.member_count < team.max_members);

  const teamHistory: TeamHistoryItem[] = teamHistoryRaw.map((row) => ({
    id: String(row.id),
    action: String(row.action),
    created_at: String(row.created_at),
    old_value: (row.old_value as Record<string, unknown> | null) ?? null,
    new_value: (row.new_value as Record<string, unknown> | null) ?? null,
  }));

  const registrations: RegistrationItem[] = registrationsRaw.map((row) => ({
    id: row.id as string,
    status: row.status as string,
    created_at: row.created_at as string,
    event_title:
      ((Array.isArray(row.events) ? row.events[0] : row.events) as { title?: string } | null)?.title ?? "Evento",
  }));

  const logs: LogItem[] = logsRaw.map((row) => ({
    id: row.id as string,
    action: row.action as string,
    created_at: row.created_at as string,
    details: (row.details as Record<string, unknown> | null) ?? null,
  }));

  const losses = Math.max(0, matchesPlayed - wins);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-6">
        <Link href="/admin/members" className="text-sm text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
          Voltar para membros
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{profile.display_name || profile.username || "Usuario"}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          @{profile.username || "-"} - {profile.email ?? "sem email"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <AdminBadge tone={profile.role === "owner" ? "active" : profile.role === "admin" ? "info" : "inactive"}>
            {profile.role}
          </AdminBadge>
          {profile.is_banned ? <AdminBadge tone="danger">Banido</AdminBadge> : <AdminBadge tone="active">Ativo</AdminBadge>}
        </div>
        <div className="mt-4">
          <MemberDetailActions userId={id} currentRole={profile.role} isBanned={profile.is_banned} />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Perfil</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>Discord ID: {profile.discord_id ?? "-"}</li>
            <li>Xbox: {profile.xbox_gamertag ?? "-"}</li>
            <li>Membro desde: {dateFmt.format(new Date(profile.created_at))}</li>
            <li>Ultimo login: {dateFmt.format(new Date(profile.updated_at))}</li>
            <li>Status: {profile.is_banned ? "Banido" : "Ativo"}</li>
            <li>Motivo do ban: {profile.ban_reason ?? profile.banned_reason ?? "-"}</li>
            <li>Banido em: {profile.banned_at ? dateFmt.format(new Date(profile.banned_at)) : "-"}</li>
          </ul>
          {adminProfile?.role === "owner" && (
            <AdminXboxControl userId={id} currentGamertag={profile.xbox_gamertag} adminRole={adminProfile.role} />
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5 lg:col-span-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Shield className="h-4 w-4" />
            Equipes ({teams.length})
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {teams.map((team) => (
              <li key={`${team.id}-${team.role}`} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 p-3 text-sm">
                <Link href={`/admin/teams/${team.id}`} className="font-medium text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
                  {team.name}
                </Link>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cargo: {team.role === "captain" ? "Capitao" : "Membro"}</p>
                <p className="text-xs text-slate-500">Entrada: {dateFmt.format(new Date(team.joined_at))}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Users className="h-4 w-4" />
            Estatisticas
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>Equipes que participa: {teams.length}</li>
            <li>Torneios inscritos: {registrations.length}</li>
            <li>Partidas jogadas: {matchesPlayed}</li>
            <li>Vitorias / Derrotas: {wins} / {losses}</li>
            <li>Ranking atual: {rankingRaw?.rank_position ? `#${rankingRaw.rank_position}` : "-"}</li>
            <li>Pontos: {rankingRaw?.points ?? 0}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Calendar className="h-4 w-4" />
            Torneios inscritos
          </h2>
          <ul className="mt-3 space-y-2">
            {registrations.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 p-2 text-sm">
                <p className="text-slate-800 dark:text-slate-100">{item.event_title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Status: {item.status} - {dateFmt.format(new Date(item.created_at))}
                </p>
              </li>
            ))}
            {registrations.length === 0 ? <li className="text-sm text-slate-500">Sem torneios vinculados.</li> : null}
          </ul>
        </article>
      </div>

      <MemberTeamManagement
        userId={id}
        targetRole={profile.role}
        adminRole={adminProfile?.role === "owner" ? "owner" : "admin"}
        currentTeams={teams}
        availableTeams={availableTeams}
        history={teamHistory}
      />

      <section className="rounded-2xl border border-rose-200 dark:border-rose-300/35 bg-rose-50 dark:bg-rose-300/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-rose-800 dark:text-rose-100">
              <AlertTriangle className="h-5 w-5" />
              Gerenciamento de Conta
            </h2>
            <p className="mt-1 text-sm text-rose-600 dark:text-rose-50/90">
              Esta zona permite deletar permanentemente a conta. A acao e irreversivel.
            </p>
          </div>

          {adminProfile?.id ? (
            <DeleteUserAccountControl
              target={{
                id: profile.id,
                avatarUrl: profile.avatar_url,
                displayName: profile.display_name,
                username: profile.username,
                discordId: profile.discord_id,
                role: profile.role,
              }}
              currentAdminId={adminProfile.id}
              currentAdminRole={adminProfile.role === "owner" ? "owner" : "admin"}
              buttonLabel="Deletar Conta Permanentemente"
              redirectTo="/admin/members"
            />
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 text-sm text-rose-50 md:grid-cols-3">
          <p className="rounded-xl border border-rose-300/30 bg-slate-100 dark:bg-black/20 px-4 py-2">Equipes vinculadas: {teams.length}</p>
          <p className="rounded-xl border border-rose-300/30 bg-slate-100 dark:bg-black/20 px-4 py-2">Partidas jogadas: {matchesPlayed}</p>
          <p className="rounded-xl border border-rose-300/30 bg-slate-100 dark:bg-black/20 px-4 py-2">Cadastro: {dateFmt.format(new Date(profile.created_at))}</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Users className="h-4 w-4" />
            Logins registrados
          </h2>
          <ul className="mt-3 space-y-2">
            {loginRaw.map((log) => (
              <li key={String(log.id)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 p-2 text-xs text-slate-600 dark:text-slate-300">
                <p>{dateFmt.format(new Date(String(log.created_at)))}</p>
                <p className="text-slate-500">{JSON.stringify(log.new_value ?? log.old_value ?? {})}</p>
              </li>
            ))}
            {loginRaw.length === 0 ? <li className="text-sm text-slate-500">Sem logins registrados.</li> : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            <Users className="h-4 w-4" />
            Logs de admin relacionados
          </h2>
          <ul className="mt-3 space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 p-2 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold">{log.action}</p>
                <p>{dateFmt.format(new Date(log.created_at))}</p>
                <p className="text-slate-500">{log.details ? JSON.stringify(log.details) : "-"}</p>
              </li>
            ))}
            {logs.length === 0 ? <li className="text-sm text-slate-500">Sem logs para este membro.</li> : null}
          </ul>
        </article>
      </div>
    </section>
  );
}
