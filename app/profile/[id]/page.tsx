import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Clock, Crown, Shield, Swords, Target, Users } from "lucide-react";

import { RoleBadge } from "../../../components/profile/RoleBadge";
import { XboxStatusTag } from "../../../components/xbox-status-tag";
import { getDictionary, getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type PublicProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
  custom_status: string | null;
  boat_role: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  rankings?: {
    wins: number;
    losses: number;
    points: number;
  }[];
};

type TeamMembershipRow = {
  team_id: string;
  role: "captain" | "member";
  joined_at: string;
};

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  max_members: number | null;
};

type TeamRankingRow = {
  team_id: string;
  points: number;
  wins: number;
  losses: number;
  rank_position: number | null;
};

type TeamCard = {
  id: string;
  name: string;
  logo_url: string | null;
  role: "captain" | "member";
  joined_at: string;
  member_count: number;
  max_members: number;
  wins: number;
  losses: number;
  points: number;
  rank_position: number | null;
  tournaments_won: number;
};

type Props = { params: Promise<{ id: string }> };

export default async function PublicProfilePage({ params }: Props) {
  const dict = await getDictionary();
  const locale = await getLocale();
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, xbox_gamertag, custom_status, boat_role, role, created_at, updated_at, rankings(wins, losses, points)")
    .eq("id", id)
    .maybeSingle<PublicProfile>();

  if (!profile) notFound();

  const dateLocale = locale === "en" ? "en-US" : "pt-BR";
  const memberSince = new Intl.DateTimeFormat(dateLocale, {
    timeZone: "America/Sao_Paulo",
    dateStyle: "medium",
  }).format(new Date(profile.created_at));
  const lastActivity = profile.updated_at
    ? new Intl.DateTimeFormat(dateLocale, {
        timeZone: "America/Sao_Paulo",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(profile.updated_at))
    : "--";

  const { data: membershipsRaw } = await supabase
    .from("team_members")
    .select("team_id, role, joined_at")
    .eq("user_id", id)
    .returns<TeamMembershipRow[]>();

  const memberships = membershipsRaw ?? [];
  const teamIds = Array.from(new Set(memberships.map((membership) => membership.team_id)));

  const [teamsResponse, countsResponse, rankingsResponse, finalWinsResponse] = teamIds.length
    ? await Promise.all([
        supabase.from("teams").select("id, name, logo_url, max_members").in("id", teamIds).returns<TeamRow[]>(),
        supabase.from("team_members").select("team_id").in("team_id", teamIds),
        supabase
          .from("team_rankings")
          .select("team_id, points, wins, losses, rank_position")
          .in("team_id", teamIds)
          .returns<TeamRankingRow[]>(),
        supabase.from("matches").select("event_id, winner_id").in("winner_id", teamIds).is("next_match_id", null),
      ])
    : [
        { data: [] as TeamRow[], error: null },
        { data: [] as Array<{ team_id: string }>, error: null },
        { data: [] as TeamRankingRow[], error: null },
        { data: [] as Array<{ event_id: string; winner_id: string }>, error: null },
      ];

  const teamMap = new Map<string, TeamRow>();
  for (const team of teamsResponse.data ?? []) {
    teamMap.set(String(team.id), team);
  }

  const memberCountMap = new Map<string, number>();
  for (const row of countsResponse.data ?? []) {
    const teamId = String(row.team_id);
    memberCountMap.set(teamId, (memberCountMap.get(teamId) ?? 0) + 1);
  }

  const rankingMap = new Map<string, TeamRankingRow>();
  for (const row of rankingsResponse.data ?? []) {
    rankingMap.set(String(row.team_id), row);
  }

  const tournamentWinMap = new Map<string, number>();
  for (const row of finalWinsResponse.data ?? []) {
    const winnerId = String(row.winner_id);
    tournamentWinMap.set(winnerId, (tournamentWinMap.get(winnerId) ?? 0) + 1);
  }

  const teams: TeamCard[] = memberships
    .map((membership) => {
      const team = teamMap.get(membership.team_id);
      if (!team) return null;

      const ranking = rankingMap.get(membership.team_id);
      return {
        id: team.id,
        name: team.name,
        logo_url: team.logo_url ?? null,
        role: membership.role,
        joined_at: membership.joined_at,
        member_count: memberCountMap.get(team.id) ?? 1,
        max_members: team.max_members ?? 10,
        wins: Number(ranking?.wins ?? 0),
        losses: Number(ranking?.losses ?? 0),
        points: Number(ranking?.points ?? 0),
        rank_position: ranking?.rank_position ?? null,
        tournaments_won: tournamentWinMap.get(team.id) ?? 0,
      } satisfies TeamCard;
    })
    .filter((team): team is TeamCard => Boolean(team))
    .sort((a, b) => {
      const roleA = a.role === "captain" ? 0 : 1;
      const roleB = b.role === "captain" ? 0 : 1;
      if (roleA !== roleB) return roleA - roleB;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });

  const playerRanking = profile.rankings?.[0];
  const boatRoles = profile.boat_role
    ? profile.boat_role.split(",").map((role) => role.trim()).filter(Boolean)
    : [];
  const roleKey = profile.role === "owner" ? "owner" : profile.role === "admin" ? "admin" : "member";
  const roleLabel = roleKey === "owner" ? dict.profile.roleOwner : roleKey === "admin" ? dict.profile.roleAdmin : dict.profile.roleMember;
  const roleBadgeClasses = roleKey === "owner"
    ? "border-amber-400/45 bg-amber-100 text-amber-800 dark:border-amber-400/35 dark:bg-amber-400/15 dark:text-amber-200"
    : roleKey === "admin"
      ? "border-slate-400/45 bg-slate-200 text-slate-700 dark:border-slate-300/35 dark:bg-slate-400/15 dark:text-slate-200"
      : "border-orange-500/40 bg-orange-100 text-orange-800 dark:border-orange-400/35 dark:bg-orange-400/15 dark:text-orange-200";
  const RoleIcon = roleKey === "owner" ? Crown : roleKey === "admin" ? Shield : Users;
  const crewVictories = teams.reduce((sum, team) => sum + team.wins, 0);
  const crewLosses = teams.reduce((sum, team) => sum + team.losses, 0);
  const winRate = crewVictories + crewLosses > 0 ? Math.round((crewVictories / (crewVictories + crewLosses)) * 100) : 0;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-4 py-16 text-slate-900 md:px-6 dark:bg-[radial-gradient(ellipse_at_top,_#0f2847_0%,_#0b1826_50%,_#050b12_100%)] dark:text-slate-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          {dict.profile.backHome}
        </Link>

        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/65 dark:shadow-2xl dark:shadow-black/30">
          <div className="h-1.5 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

          <div className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.08),transparent_24%)]" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/5 to-transparent dark:from-cyan-400/5" />

            <div className="relative px-6 py-6 sm:px-8 sm:py-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
                <div className="md:col-span-1 lg:col-span-4">
                  <div className="flex h-full flex-col items-center rounded-[1.75rem] border border-slate-200/80 bg-slate-50/85 p-6 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:p-7">
                    <h1 className="mb-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                      {profile.display_name}
                    </h1>

                    <span className={`mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${roleBadgeClasses}`}>
                      <RoleIcon className="h-3.5 w-3.5" />
                      {roleLabel}
                    </span>

                    <div className="relative mb-4 h-32 w-32 overflow-hidden rounded-full border-2 border-amber-400/70 bg-slate-200 sm:h-36 sm:w-36 dark:bg-slate-800">
                      {profile.avatar_url ? (
                        <Image
                          src={profile.avatar_url}
                          alt={profile.display_name}
                          fill
                          sizes="(min-width: 1024px) 176px, (min-width: 640px) 160px, 160px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-yellow-600 dark:text-yellow-400">
                          {profile.display_name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="mb-4 w-full max-w-xs">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {dict.profile.xboxAccount}
                      </p>
                      <div className="flex justify-center">
                        <XboxStatusTag gamertag={profile.xbox_gamertag} emptyLabel={dict.profile.xboxNotLinked} />
                      </div>
                    </div>

                    <div className="mb-4 w-full max-w-xs">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {dict.profile.inGameRoles}
                      </p>
                      {boatRoles.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-2">
                          {boatRoles.slice(0, 4).map((role) => (
                            <RoleBadge key={role} role={role} size="sm" />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {dict.profile.noInGameRoles}
                        </p>
                      )}
                    </div>

                    <div className="w-full max-w-xs">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {dict.profile.memberSince}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {memberSince}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-1 lg:col-span-8">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <InfoPanel
                      title={dict.profile.lastActivity}
                      value={lastActivity}
                      icon={<Clock className="h-4 w-4 text-cyan-400" />}
                    />
                    <StatCard icon={<Target className="h-4 w-4 text-emerald-400" />} label={dict.profile.leaguePoints} value={playerRanking?.points ?? 0} description="Season pressure" tone="emerald" />
                    <StatCard icon={<Swords className="h-4 w-4 text-cyan-400" />} label={dict.profile.winsLosses} value={`${crewVictories}/${crewLosses}`} description={`${dict.profile.winRate}: ${winRate}%`} tone="cyan" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-xl dark:border-white/10 dark:bg-slate-950/60 dark:shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{dict.profile.currentTeams}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dict.profile.currentTeamsDesc}</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {teams.length}
            </span>
          </div>

          {teams.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <Link key={team.id} href={`/teams/${team.id}`} className="group rounded-3xl border border-slate-200 bg-slate-50/80 p-5 transition hover:border-amber-400/40 hover:bg-amber-50 dark:border-white/10 dark:bg-white/4 dark:hover:bg-amber-400/8">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
                      {team.logo_url ? (
                        <Image src={team.logo_url} alt={team.name} width={56} height={56} className="h-full w-full object-contain" />
                      ) : (
                        <Users className="h-6 w-6 text-amber-400/70" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="truncate text-lg font-bold text-slate-900 dark:text-white">{team.name}</p>
                          <span className="mt-1 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                            {team.role === "captain" ? dict.profile.teamCaptain : dict.profile.teamMember}
                          </span>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-amber-400" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <CompactMeta>{dict.profile.teamPoints}: {team.points}</CompactMeta>
                    <CompactMeta>{dict.profile.winsLosses}: {team.wins}/{team.losses}</CompactMeta>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{dict.profile.teamRank}: {team.rank_position ? `#${team.rank_position}` : "-"}</span>
                    <span>
                      {dict.profile.memberSince}: {new Intl.DateTimeFormat(dateLocale, { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(team.joined_at))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center dark:border-white/10 dark:bg-white/2">
              <Users className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{dict.profile.noTeamsYet}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dict.profile.noTeamsDesc}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoPanel({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <div className="h-full rounded-[1.6rem] border border-slate-200 bg-slate-50/85 p-6 text-left shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function StatCard({ icon, label, value, description, tone }: { icon: ReactNode; label: string; value: string | number; description: string; tone: "emerald" | "cyan" | "amber" | "violet" }) {
  const toneClasses = {
    emerald: "before:bg-emerald-400/70",
    cyan: "before:bg-cyan-400/70",
    amber: "before:bg-amber-400/70",
    violet: "before:bg-violet-400/70",
  } satisfies Record<string, string>;

  return (
    <div className={`relative h-full overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50/90 p-6 text-left shadow-sm before:absolute before:left-4 before:right-4 before:top-0 before:h-px dark:border-white/10 dark:bg-white/5 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{description}</p>
    </div>
  );
}

function CompactMeta({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/5 px-3 py-1.5 dark:bg-white/5">
      {children}
    </span>
  );
}
