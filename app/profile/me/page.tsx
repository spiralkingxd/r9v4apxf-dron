import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Calendar, Clock, Crown, Shield, Swords, Target } from "lucide-react";

import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { ProfileTeamsSection } from "@/components/profile-teams-section";
import { XboxStatusTag } from "@/components/xbox-status-tag";
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
  const playerRanking = profile.rankings?.[0];
  const crewVictories = userTeams.reduce((sum, team) => sum + team.wins, 0);
  const crewLosses = userTeams.reduce((sum, team) => sum + team.losses, 0);
  const winRate = crewVictories + crewLosses > 0 ? Math.round((crewVictories / (crewVictories + crewLosses)) * 100) : 0;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 dark:bg-[radial-gradient(ellipse_at_top,_#0f2847_0%,_#0b1826_50%,_#050b12_100%)] px-4 py-16 text-slate-900 dark:text-slate-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/65 dark:shadow-2xl dark:shadow-black/30">

          <div className="h-1.5 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

          <div className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.08),transparent_24%)]" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/5 to-transparent dark:from-cyan-400/5" />

            <div className="relative px-6 py-6 sm:px-8 sm:py-8">
              <div className="space-y-8">
                <div className="flex justify-end xl:hidden">
                  <ProfileSettingsForm
                    initialStatus={profile.custom_status}
                    initialRole={profile.boat_role}
                    initialXboxGamertag={profile.xbox_gamertag}
                  />
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="relative h-28 w-28 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-200 ring-2 ring-yellow-400/55 ring-offset-1 ring-offset-slate-900 shadow-lg dark:bg-slate-800">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                        {profile.display_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 min-w-0 max-w-3xl space-y-4">
                    <div>
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90 dark:text-amber-200">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Command center
                      </div>
                      <h1 className="flex flex-wrap items-center gap-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                        <span>{profile.display_name}</span>
                        {profile.role === "owner" ? <Crown className="h-6 w-6 text-yellow-500" /> : null}
                        {profile.role === "admin" ? <Shield className="h-6 w-6 text-cyan-500" /> : null}
                      </h1>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/5 px-3 py-1 dark:bg-white/5">
                          <Calendar className="h-4 w-4 text-cyan-400" />
                          {dict.profile.memberSince}: {memberSince}
                        </span>
                      </div>
                    </div>

                    {profile.custom_status ? (
                      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {profile.custom_status}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <XboxStatusTag gamertag={profile.xbox_gamertag} emptyLabel={dict.profile.xboxNotLinked} />
                      {boatRoles.map((role) => (
                        <span key={role} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200 capitalize">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoPanel
                      title={dict.profile.memberSince}
                      value={memberSince}
                      icon={<Calendar className="h-4 w-4 text-cyan-400" />}
                    />
                    <InfoPanel
                      title={dict.profile.lastActivity}
                      value={lastActivity}
                      icon={<Clock className="h-4 w-4 text-cyan-400" />}
                    />
                  </div>

                  <div className="space-y-4 xl:pt-1">
                    <div className="hidden justify-end xl:flex">
                      <ProfileSettingsForm
                        initialStatus={profile.custom_status}
                        initialRole={profile.boat_role}
                        initialXboxGamertag={profile.xbox_gamertag}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
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
    <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/85 px-5 py-5 text-center shadow-sm dark:border-white/10 dark:bg-white/5 sm:text-left">
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400 sm:justify-start">
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
    <div className={`relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50/90 p-4 text-center shadow-sm before:absolute before:left-4 before:right-4 before:top-0 before:h-px dark:border-white/10 dark:bg-white/5 ${toneClasses[tone]}`}>
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{description}</p>
    </div>
  );
}

