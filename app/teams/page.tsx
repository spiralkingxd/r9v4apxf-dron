import Image from "next/image";
import Link from "next/link";
import { Anchor, Calendar, Crown, Users } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import { getDictionary } from "@/lib/i18n";

type TeamListRow = {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  captain_id: string;
  captain: { id: string; display_name: string; avatar_url: string | null } | null;
  member_count: number;
  max_members: number;
  is_user_member: boolean;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium" });

const getCachedTeams = unstable_cache(
  async () => {
    const supabaseAction = createAdminClient();
    if (!supabaseAction) return [];

    const { data: teamsRaw } = await supabaseAction
      .from("teams")
      .select("id, name, logo_url, captain_id, max_members, created_at")        
      .is("dissolved_at", null)
      .order("created_at", { ascending: false });

    if (!teamsRaw || teamsRaw.length === 0) return [];

    const teamIds = teamsRaw.map((t) => t.id as string);
    const { data: memberCounts } = await supabaseAction
      .from("team_members")
      .select("team_id, user_id")
      .in("team_id", teamIds);

    const captainIds = Array.from(new Set(teamsRaw.map((t) => t.captain_id as string)));                                                                            
    const { data: captainProfiles } = await supabaseAction
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", captainIds);

    const captainMap = new Map<string, { id: string; display_name: string; avatar_url: string | null }>();                                                          
    for (const row of captainProfiles ?? []) {
      captainMap.set(row.id as string, {
        id: row.id as string,
        display_name: (row.display_name as string) ?? "Capitão",
        avatar_url: (row.avatar_url as string | null) ?? null,
      });
    }

    const countMap = new Map<string, number>();
    const memberMap = new Map<string, Set<string>>();
    for (const row of memberCounts ?? []) {
      const teamId = row.team_id as string;
      const userId = row.user_id as string;
      
      countMap.set(teamId, (countMap.get(teamId) ?? 0) + 1);
      
      if (!memberMap.has(teamId)) memberMap.set(teamId, new Set());
      memberMap.get(teamId)!.add(userId);
    }

    return teamsRaw.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      logo_url: (t.logo_url as string | null) ?? null,
      captain_id: t.captain_id as string,
      created_at: t.created_at as string,
      captain: captainMap.get(t.captain_id as string) ?? null,
      member_count: countMap.get(t.id as string) ?? 0,
      max_members: (t.max_members as number) ?? 10,
      _members: Array.from(memberMap.get(t.id as string) ?? [])
    }));
  },
  ["teams-public-data"],
  { tags: ["teams", "public-data"], revalidate: 3600 }
);

async function getData() {
  if (!isSupabaseConfigured()) {
    return { teams: [] as TeamListRow[], userId: null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cachedTeams = await getCachedTeams();

  const teams: TeamListRow[] = cachedTeams.map((t) => ({
    id: t.id,
    name: t.name,
    logo_url: t.logo_url,
    captain_id: t.captain_id,
    created_at: t.created_at,
    captain: t.captain,
    member_count: t.member_count,
    max_members: t.max_members,
    is_user_member: user?.id ? (t._members as string[]).includes(user.id) : false,
  }));

  return { teams, userId: user?.id ?? null };
}

export default async function TeamsPage() {
  const dict = await getDictionary();
  const { teams, userId } = await getData();

  return (
    <main className="page-shell">
      <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-10 lg:px-10">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">
              {dict.teams.badge}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">{dict.teams.title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {teams.length > 0
                ? `${teams.length} equipe${teams.length !== 1 ? "s" : ""} registrada${teams.length !== 1 ? "s" : ""}`
                : "{dict.teams.empty}"}
            </p>
          </div>
        </div>

        <section>
          {teams.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="glass-card soft-ring group rounded-2xl p-5 transition hover:border-amber-400/30 hover:bg-amber-400/5"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 overflow-hidden items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">
                      {team.logo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Anchor className="h-5 w-5 text-amber-400/60" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-100 group-hover:text-white">
                        {team.name}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Users className="h-3 w-3" />
                        {team.member_count}/{team.max_members}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Crown className="h-3 w-3" />
                        {dict.teams.captain}: {team.captain?.display_name ?? "Unknown"}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" />
                        Criada em {dateFmt.format(new Date(team.created_at))}
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        {team.is_user_member ? (
                          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                            Your team
                          </span>
                        ) : null}
                        <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                          {userId && !team.is_user_member ? dict.teams.requestJoin : dict.teams.viewTeam}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <Anchor className="mx-auto h-10 w-10 text-slate-500" />
              <p className="mt-4 text-sm text-slate-400">
                {dict.teams.empty}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
