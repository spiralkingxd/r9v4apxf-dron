import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Shield, Users } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { MemberDetailActions } from "@/components/admin/member-detail-actions";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

type TeamItem = {
  id: string;
  name: string;
  role: "captain" | "member";
  joined_at: string;
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

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminMemberDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, username, discord_id, xbox_gamertag, email, role, is_banned, created_at, updated_at, banned_reason, ban_reason, banned_at",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
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
    .select("team_id, role, joined_at, teams(id, name)")
    .eq("user_id", id)
    .order("joined_at", { ascending: false });

  const teams: TeamItem[] = (teamsRaw ?? []).flatMap((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    if (!team) return [];
    return [
      {
        id: team.id as string,
        name: team.name as string,
        role: row.role as "captain" | "member",
        joined_at: row.joined_at as string,
      },
    ];
  });

  const teamIds = teams.map((team) => team.id);

  const [registrationsRawRes, logsRawRes, matchesPlayedRes, winsRes, rankingRes, loginRawRes] = await Promise.all([
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
  ]);

  const registrationsRaw = registrationsRawRes.data ?? [];
  const logsRaw = logsRawRes.data ?? [];
  const matchesPlayed = matchesPlayedRes.count ?? 0;
  const wins = winsRes.count ?? 0;
  const rankingRaw = rankingRes.data;
  const loginRaw = loginRawRes.data ?? [];

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
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <Link href="/admin/members" className="text-sm text-cyan-200 hover:text-cyan-100">
          Voltar para membros
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{profile.display_name || profile.username || "Usuario"}</h1>
        <p className="text-sm text-slate-400">
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
        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Perfil</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            <li>Discord ID: {profile.discord_id ?? "-"}</li>
            <li>Xbox: {profile.xbox_gamertag ?? "-"}</li>
            <li>Membro desde: {dateFmt.format(new Date(profile.created_at))}</li>
            <li>Ultimo login: {dateFmt.format(new Date(profile.updated_at))}</li>
            <li>Status: {profile.is_banned ? "Banido" : "Ativo"}</li>
            <li>Motivo do ban: {profile.ban_reason ?? profile.banned_reason ?? "-"}</li>
            <li>Banido em: {profile.banned_at ? dateFmt.format(new Date(profile.banned_at)) : "-"}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 lg:col-span-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Shield className="h-4 w-4" />
            Equipes ({teams.length})
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {teams.map((team) => (
              <li key={`${team.id}-${team.role}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <Link href={`/admin/teams/${team.id}`} className="font-medium text-cyan-200 hover:text-cyan-100">
                  {team.name}
                </Link>
                <p className="text-xs text-slate-400">Cargo: {team.role === "captain" ? "Capitao" : "Membro"}</p>
                <p className="text-xs text-slate-500">Entrada: {dateFmt.format(new Date(team.joined_at))}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Users className="h-4 w-4" />
            Estatisticas
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            <li>Equipes que participa: {teams.length}</li>
            <li>Torneios inscritos: {registrations.length}</li>
            <li>Partidas jogadas: {matchesPlayed}</li>
            <li>Vitorias / Derrotas: {wins} / {losses}</li>
            <li>Ranking atual: {rankingRaw?.rank_position ? `#${rankingRaw.rank_position}` : "-"}</li>
            <li>Pontos: {rankingRaw?.points ?? 0}</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Calendar className="h-4 w-4" />
            Torneios inscritos
          </h2>
          <ul className="mt-3 space-y-2">
            {registrations.map((item) => (
              <li key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm">
                <p className="text-slate-100">{item.event_title}</p>
                <p className="text-xs text-slate-400">
                  Status: {item.status} - {dateFmt.format(new Date(item.created_at))}
                </p>
              </li>
            ))}
            {registrations.length === 0 ? <li className="text-sm text-slate-500">Sem torneios vinculados.</li> : null}
          </ul>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Users className="h-4 w-4" />
            Logins registrados
          </h2>
          <ul className="mt-3 space-y-2">
            {loginRaw.map((log) => (
              <li key={String(log.id)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
                <p>{dateFmt.format(new Date(String(log.created_at)))}</p>
                <p className="text-slate-500">{JSON.stringify(log.new_value ?? log.old_value ?? {})}</p>
              </li>
            ))}
            {loginRaw.length === 0 ? <li className="text-sm text-slate-500">Sem logins registrados.</li> : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
            <Users className="h-4 w-4" />
            Logs de admin relacionados
          </h2>
          <ul className="mt-3 space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
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
