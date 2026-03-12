import Image from "next/image";
import Link from "next/link";
import { Anchor, Plus, Users } from "lucide-react";

import { CreateTeamForm } from "@/components/create-team-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type TeamListRow = {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  captain: { display_name: string; avatar_url: string | null } | null;
  member_count: number;
};

async function getData() {
  if (!isSupabaseConfigured()) {
    return { teams: [] as TeamListRow[], userId: null };
  }

  const supabase = await createClient();

  const [
    { data: { user } },
    { data: teamsRaw },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("teams")
      .select("id, name, logo_url, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (!teamsRaw || teamsRaw.length === 0) {
    return { teams: [] as TeamListRow[], userId: user?.id ?? null };
  }

  // Count members per team
  const teamIds = teamsRaw.map((t) => t.id as string);
  const { data: memberCounts } = await supabase
    .from("team_members")
    .select("team_id")
    .in("team_id", teamIds);

  const countMap = new Map<string, number>();
  for (const row of memberCounts ?? []) {
    countMap.set(row.team_id, (countMap.get(row.team_id) ?? 0) + 1);
  }

  const teams: TeamListRow[] = teamsRaw.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    logo_url: (t.logo_url as string | null) ?? null,
    created_at: t.created_at as string,
    captain: null,
    member_count: countMap.get(t.id as string) ?? 0,
  }));

  return { teams, userId: user?.id ?? null };
}

export default async function TeamsPage() {
  const { teams, userId } = await getData();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-10 lg:px-10">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">
              Equipes
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">Tripulações da Arena</h1>
            <p className="mt-2 text-sm text-slate-400">
              {teams.length > 0
                ? `${teams.length} equipe${teams.length !== 1 ? "s" : ""} registrada${teams.length !== 1 ? "s" : ""}`
                : "Nenhuma equipe cadastrada ainda"}
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Teams grid */}
          <section>
            {teams.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {teams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="group rounded-2xl border border-white/8 bg-white/4 p-5 transition hover:border-amber-400/30 hover:bg-amber-400/5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">
                        {team.logo_url ? (
                          <Image
                            src={team.logo_url}
                            alt={team.name}
                            width={48}
                            height={48}
                            className="rounded-xl object-cover"
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
                          {team.member_count} membro{team.member_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
                <Anchor className="mx-auto h-10 w-10 text-slate-500" />
                <p className="mt-4 text-sm text-slate-400">
                  Nenhuma equipe ainda. Seja o primeiro a fundar uma!
                </p>
              </div>
            )}
          </section>

          {/* Create team sidebar */}
          <aside>
            <div className="sticky top-24 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Plus className="h-5 w-5 text-amber-400" />
                Fundar nova equipe
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Apenas capitães podem inscrever equipes em torneios.
              </p>

              {userId ? (
                <div className="mt-6">
                  <CreateTeamForm />
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <p className="rounded-xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm text-amber-200">
                    Faça login para fundar uma equipe.
                  </p>
                  <Link
                    href="/auth/login?next=/teams"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Login com Discord
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
