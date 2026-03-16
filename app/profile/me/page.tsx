import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AtSign, Calendar, Clock, Target, Trophy } from "lucide-react";

import { upsertProfileFromOAuth } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { ProfileTeamsSection } from "@/components/profile-teams-section";
import { XboxStatusTag } from "@/components/xbox-status-tag";
import { ProfileSettingsForm } from "@/components/profile-settings-form";

type ProfileRow = {
  id: string;
  display_name: string;
  username: string;
  xbox_gamertag: string | null;
  avatar_url: string | null;
  custom_status: string | null;
  boat_role: string | null;
  created_at: string;
  updated_at: string;
  rankings?: { wins: number; points: number; }[] | null;
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
};

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/profile/me");
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, xbox_gamertag, avatar_url, custom_status, boat_role, created_at, updated_at, rankings(wins, points)")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    await upsertProfileFromOAuth();

    const { data: recoveredProfile } = await supabase
      .from("profiles")
      .select("id, display_name, username, xbox_gamertag, avatar_url, custom_status, boat_role, created_at, updated_at, rankings(wins, points)")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    profile = recoveredProfile;
  }

  if (!profile) {
    redirect("/");
  }

  let teamsError: string | null = null;
  let userTeams: UserTeamCard[] = [];

  const { data: membershipsRaw, error: membershipsError } = await supabase
    .from("team_members")
    .select("team_id, role, joined_at")
    .eq("user_id", user.id);

  if (membershipsError) {
    teamsError = "Não foi possível carregar suas equipes agora.";
  } else {
    const memberships = (membershipsRaw ?? []) as TeamMemberRow[];
    const teamIds = Array.from(new Set(memberships.map((m) => m.team_id)));

    const { data: teamsRaw, error: teamsLoadError } = teamIds.length
      ? await supabase
          .from("teams")
          .select("id, name, logo_url, max_members")
          .in("id", teamIds)
      : { data: [] as TeamRow[], error: null };

    if (teamsLoadError) {
      teamsError = "Não foi possível carregar suas equipes agora.";
    }

    const teamMap = new Map<string, TeamRow>();
    for (const team of teamsRaw ?? []) {
      teamMap.set(team.id as string, {
        id: team.id as string,
        name: team.name as string,
        logo_url: (team.logo_url as string | null) ?? null,
        max_members: (team.max_members as number) ?? 10,
      });
    }

    let countMap = new Map<string, number>();

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

    userTeams = memberships
      .map((membership) => {
        const related = teamMap.get(membership.team_id);
        if (!related) return null;

        return {
          id: related.id,
          name: related.name,
          logo_url: related.logo_url,
          role: membership.role,
          joined_at: membership.joined_at,
          member_count: countMap.get(related.id) ?? 1,
          max_members: related.max_members ?? 10,
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

  const memberSince = new Date(profile.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 dark:bg-[radial-gradient(ellipse_at_top,_#0f2847_0%,_#0b1826_50%,_#050b12_100%)] px-4 py-16 text-slate-900 dark:text-slate-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/70 shadow-xl dark:shadow-2xl dark:shadow-black/40 backdrop-blur-sm">
          {/* Gold accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

          {/* Avatar + Name header */}
          <div className="flex flex-col items-center gap-4 px-8 pb-8 pt-10">
            {/* Avatar with golden ring */}
            <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-yellow-400/70 ring-offset-2 ring-offset-slate-900 shadow-[0_0_32px_rgba(250,204,21,0.20)]">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 dark:bg-slate-800 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {profile.display_name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Display name */}
            <h1 className="text-2xl font-bold tracking-wide text-slate-900 dark:text-white flex flex-col items-center">
              {profile.display_name}
              {profile.custom_status && (
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {profile.custom_status}
                </span>
              )}
            </h1>

            {/* Xbox status and Boat Role */}
            <div className="flex gap-4 items-center">
              <XboxStatusTag gamertag={profile.xbox_gamertag} />
              {profile.boat_role && profile.boat_role !== "nenhuma" && (
                <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold capitalize">
                  {profile.boat_role}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-8 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent" />

          {/* Info grid - Top Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-slate-200 dark:sm:divide-white/5 border-b border-slate-200 dark:border-white/5">
            <InfoCard icon={<AtSign className="h-4 w-4 text-cyan-400" />} label="Username">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">@{profile.username}</span>
            </InfoCard>

            <InfoCard icon={<Calendar className="h-4 w-4 text-cyan-400" />} label="Membro desde">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{memberSince}</span>
            </InfoCard>

            <InfoCard icon={<Clock className="h-4 w-4 text-cyan-400" />} label="Última atividade">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {profile.updated_at ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(profile.updated_at)) : "--"}
              </span>
            </InfoCard>
          </div>

          {/* Info grid - Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-white/5">
            <InfoCard icon={<Target className="h-4 w-4 text-emerald-400" />} label="Pontos de Liga">
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.rankings?.[0]?.points || 0}</span>
            </InfoCard>

            <InfoCard icon={<Trophy className="h-4 w-4 text-amber-400" />} label="Torneios Ganhos">
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.rankings?.[0]?.wins || 0}</span>
            </InfoCard>
          </div>

          <div className="pb-8">
            <ProfileSettingsForm 
              initialStatus={profile.custom_status} 
              initialRole={profile.boat_role} 
            />
          </div>
        </div>

        <ProfileTeamsSection
          userId={user.id}
          teams={userTeams}
          teamsError={teamsError}
        />
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
