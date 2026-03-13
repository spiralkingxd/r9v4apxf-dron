import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AtSign, Calendar } from "lucide-react";

import { upsertProfileFromOAuth } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { ProfileTeamsSection } from "@/components/profile-teams-section";
import { XboxStatusTag } from "@/components/xbox-status-tag";

type ProfileRow = {
  id: string;
  display_name: string;
  username: string;
  xbox_gamertag: string | null;
  avatar_url: string | null;
  created_at: string;
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
  teams: TeamRow | TeamRow[] | null;
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
    .select("id, display_name, username, xbox_gamertag, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    await upsertProfileFromOAuth();

    const { data: recoveredProfile } = await supabase
      .from("profiles")
      .select("id, display_name, username, xbox_gamertag, avatar_url, created_at")
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
    .select("team_id, role, joined_at, teams(id, name, logo_url, max_members)")
    .eq("user_id", user.id);

  if (membershipsError) {
    teamsError = "Não foi possível carregar suas equipes agora.";
  } else {
    const memberships = (membershipsRaw ?? []) as TeamMemberRow[];
    const teamIds = memberships.map((m) => m.team_id);

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
        const related = Array.isArray(membership.teams)
          ? membership.teams[0]
          : membership.teams;

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

  const memberSince = new Date(profile.created_at).toLocaleDateString("pt-BR");

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_at_top,_#0f2847_0%,_#0b1826_50%,_#050b12_100%)] px-4 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/40 backdrop-blur-sm">
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
                <div className="flex h-full w-full items-center justify-center bg-slate-800 text-3xl font-bold text-yellow-400">
                  {profile.display_name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Display name */}
            <h1 className="text-2xl font-bold tracking-wide text-white">
              {profile.display_name}
            </h1>

            {/* Xbox status */}
            <XboxStatusTag gamertag={profile.xbox_gamertag} />
          </div>

          {/* Divider */}
          <div className="mx-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-white/5">
            <InfoCard
              icon={<AtSign className="h-4 w-4 text-cyan-400" />}
              label="Username"
            >
              <span className="text-sm font-semibold text-slate-100">
                @{profile.username}
              </span>
            </InfoCard>

            <InfoCard
              icon={<Calendar className="h-4 w-4 text-cyan-400" />}
              label="Membro desde"
            >
              <span className="text-sm font-semibold text-slate-100">
                {memberSince}
              </span>
            </InfoCard>
          </div>

          <div className="pb-8" />
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
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}