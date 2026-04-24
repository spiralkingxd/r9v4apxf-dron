import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Clock, Crown, Shield, Swords, Target, Users } from "lucide-react";

import { RoleBadge } from "../../../components/profile/RoleBadge";
import { ProfileSettingsForm } from "../../../components/profile-settings-form";
import { ProfileTeamsSection } from "../../../components/profile-teams-section";
import { XboxStatusTag } from "../../../components/xbox-status-tag";
import { upsertProfileFromOAuth } from "@/lib/auth/profile";
import { getDictionary, getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  display_name: string;
  username: string;
  xbox_gamertag: string | null;
  avatar_url: string | null;
  custom_status: string | null;
  boat_role: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  rankings?: { wins: number; losses: number; points: number; }[] | null;
};

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  max_members: number;
};

type TeamMemberRow = {
  team_id: string;
  role: "captain" | "member";
  joined_at: string;
};

type UserTeamCard = {
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
  tournaments_won: number;
  rank_position: number | null;
};

export default async function MyProfilePage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/profile/me");
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, xbox_gamertag, avatar_url, custom_status, boat_role, role, created_at, updated_at, rankings(wins, losses, points)")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    await upsertProfileFromOAuth();

    const { data: recoveredProfile } = await supabase
      .from("profiles")
      .select("id, display_name, username, xbox_gamertag, avatar_url, custom_status, boat_role, role, created_at, updated_at, rankings(wins, losses, points)")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    profile = recoveredProfile;
  }

  if (!profile) {
    redirect("/");
  }

  let teamsError: string | null = null;
  let maxTeamSize = 5;
  let userTeams: UserTeamCard[] = [];
  let teamIds: string[] = [];
  const { data: membershipsRaw, error: membershipsError } = await supabase
    .from("team_members")
    .select("team_id, role, joined_at")
    .eq("user_id", user.id);

  if (membershipsError) {
    teamsError = dict.profile.loadTeamsError;
  } else {
    const memberships = (membershipsRaw ?? []) as TeamMemberRow[];
    teamIds = Array.from(new Set(memberships.map((m) => m.team_id)));

    const { data: teamsRaw, error: teamsLoadError } = teamIds.length
      ? await supabase
          .from("teams")
          .select("id, name, logo_url, max_members")
          .in("id", teamIds)
      : { data: [] as TeamRow[], error: null };

    if (teamsLoadError) {
      teamsError = dict.profile.loadTeamsError;
    }

    const { data: sysSettings } = await supabase.from("system_settings").select("tournament").eq("id", 1).maybeSingle();
    const tournamentSettings = sysSettings?.tournament as { max_team_size?: number } | null | undefined;
    maxTeamSize = Number(tournamentSettings?.max_team_size ?? 5);
    const teamMap = new Map<string, TeamRow>();
    for (const team of teamsRaw ?? []) {
      teamMap.set(team.id as string, {
        id: team.id as string,
        name: team.name as string,
        logo_url: (team.logo_url as string | null) ?? null,
        max_members: (team.max_members as number) ?? 10,
      });
    }

    const countMap = new Map<string, number>();

    if (teamIds.length > 0) {
      const { data: countsRaw } = await supabase
        .from("team_members")
        .select("team_id")
        .in("team_id", teamIds);

      for (const row of countsRaw ?? []) {
        const teamId = row.team_id as string;
        countMap.set(teamId, (countMap.get(teamId) ?? 0) + 1);
      }
    }

    const [teamRankingsResponse, finalWinsResponse] = teamIds.length
      ? await Promise.all([
          supabase.from("team_rankings").select("team_id, wins, losses, points, rank_position").in("team_id", teamIds),
          supabase.from("matches").select("event_id, winner_id").in("winner_id", teamIds).is("next_match_id", null),
        ])
      : [
          { data: [] as Array<{ team_id: string; wins: number; losses: number; points: number; rank_position: number | null }>, error: null },
          { data: [] as Array<{ event_id: string; winner_id: string }>, error: null },
        ];

    const teamRankingMap = new Map(
      (teamRankingsResponse.data ?? []).map((row) => [String(row.team_id), {
        wins: Number(row.wins ?? 0),
        losses: Number(row.losses ?? 0),
        points: Number(row.points ?? 0),
        rank_position: row.rank_position ?? null,
      }]),
    );
    const teamTournamentWinsMap = new Map<string, number>();
    for (const row of finalWinsResponse.data ?? []) {
      const teamId = String(row.winner_id);
      const current = teamTournamentWinsMap.get(teamId) ?? 0;
      teamTournamentWinsMap.set(teamId, current + 1);
    }
    userTeams = memberships
      .map((membership) => {
        const related = teamMap.get(membership.team_id);
        if (!related) return null;
        
        const ranking = teamRankingMap.get(related.id);
        const tourneyWins = teamTournamentWinsMap.get(related.id) ?? 0;

        return {
          id: related.id,
          name: related.name,
          logo_url: related.logo_url,
          role: membership.role,
          joined_at: membership.joined_at,
          member_count: countMap.get(related.id) ?? 1,
          max_members: related.max_members ?? 10,
          wins: ranking?.wins ?? 0,
          losses: ranking?.losses ?? 0,
          points: ranking?.points ?? 0,
          tournaments_won: tourneyWins,
          rank_position: ranking?.rank_position ?? null,
        } satisfies UserTeamCard;
      })
      .filter((team): team is UserTeamCard => Boolean(team))
      .sort((a, b) => {
        const roleA = a.role === "captain" ? 0 : 1;
        const roleB = b.role === "captain" ? 0 : 1;
        if (roleA !== roleB) return roleA - roleB;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      });
  }

  const dateLocale = locale === "en" ? "en-US" : "pt-BR";
  const memberSince = new Intl.DateTimeFormat(dateLocale, { timeZone: "America/Sao_Paulo", dateStyle: "medium" }).format(new Date(profile.created_at));
  const lastActivity = profile.updated_at
    ? new Intl.DateTimeFormat(dateLocale, { timeZone: "America/Sao_Paulo", dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.updated_at))
    : "--";
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
  const playerRanking = profile.rankings?.[0];
  const crewVictories = userTeams.reduce((sum, team) => sum + team.wins, 0);
  const crewLosses = userTeams.reduce((sum, team) => sum + team.losses, 0);
  const winRate = crewVictories + crewLosses > 0 ? Math.round((crewVictories / (crewVictories + crewLosses)) * 100) : 0;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 dark:bg-[radial-gradient(ellipse_at_top,_#0f2847_0%,_#0b1826_50%,_#050b12_100%)] px-4 py-16 text-slate-900 md:px-6 dark:text-slate-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/65 dark:shadow-2xl dark:shadow-black/30">

          <div className="h-1.5 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

          <div className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.08),transparent_24%)]" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/5 to-transparent dark:from-cyan-400/5" />

            <div className="relative px-6 py-6 sm:px-8 sm:py-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
                <div className="md:col-span-1 lg:col-span-4">
                  <div className="flex h-full flex-col items-center rounded-[1.75rem] border border-slate-200/80 bg-slate-50/85 p-6 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:p-7">
                    <div className="mb-3 flex w-full items-start justify-between gap-3">
                      <h1 className="text-left text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                        {profile.display_name}
                      </h1>
                      <ProfileSettingsForm
                        initialStatus={profile.custom_status}
                        initialRole={profile.boat_role}
                        initialXboxGamertag={profile.xbox_gamertag}
                        triggerMode="icon"
                        triggerTitle="Configurar Perfil"
                      />
                    </div>

                    <span className={`mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${roleBadgeClasses}`}>
                      <RoleIcon className="h-3.5 w-3.5" />
                      {roleLabel}
                    </span>

                    <div className="relative mb-4 h-32 w-32 overflow-hidden rounded-full border-2 border-amber-400/70 bg-slate-200 sm:h-36 sm:w-36 dark:bg-slate-800">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.display_name}
                          className="h-full w-full object-cover"
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
                  <div className="space-y-6">
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
          </div>
        </div>

        <ProfileTeamsSection dict={dict} locale={dateLocale} systemMaxMembers={maxTeamSize}
          userId={user.id}
          userXboxGamertag={profile.xbox_gamertag}
          teams={userTeams}
          teamsError={teamsError}
        />
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

