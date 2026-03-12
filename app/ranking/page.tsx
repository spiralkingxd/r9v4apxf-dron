import Image from "next/image";
import { Trophy } from "lucide-react";

import { RankingLiveSync } from "@/components/ranking-live-sync";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type RankingRow = {
  id: string;
  profile_id: string;
  points: number;
  wins: number;
  losses: number;
  rank_position: number | null;
};

type ProfileRow = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
};

async function getRankingData() {
  if (!isSupabaseConfigured()) {
    return [] as Array<RankingRow & { profile: ProfileRow | null }>;
  }

  const supabase = await createClient();

  const { data: rankings } = await supabase
    .from("rankings")
    .select("id, profile_id, points, wins, losses, rank_position")
    .order("points", { ascending: false })
    .order("wins", { ascending: false })
    .order("losses", { ascending: true });

  const profileIds = (rankings ?? []).map((r) => r.profile_id as string);

  if (profileIds.length === 0) {
    return [] as Array<RankingRow & { profile: ProfileRow | null }>;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, xbox_gamertag")
    .in("id", profileIds);

  const byId = new Map<string, ProfileRow>();
  for (const profile of profiles ?? []) {
    byId.set(profile.id as string, profile as ProfileRow);
  }

  return (rankings ?? []).map((row) => ({
    ...(row as RankingRow),
    profile: byId.get(row.profile_id as string) ?? null,
  }));
}

export default async function RankingPage() {
  const rows = await getRankingData();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] px-6 py-10 text-slate-100 lg:px-10">
      <RankingLiveSync />
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">Ranking Geral</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Classificação dos Piratas</h1>
          <p className="mt-2 text-sm text-slate-400">Ordenado por pontos e vitórias.</p>
        </div>

        {rows.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-slate-400">
            Ainda não há pontuação registrada.
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Posição</th>
                    <th className="px-4 py-3">Pirata</th>
                    <th className="px-4 py-3">Xbox</th>
                    <th className="px-4 py-3 text-right">Pontos</th>
                    <th className="px-4 py-3 text-right">V / D</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => {
                    const displayName = row.profile?.display_name ?? row.profile?.username ?? "Jogador";
                    const avatar = row.profile?.avatar_url;
                    const topClass =
                      index === 0
                        ? "bg-amber-400/10"
                        : index === 1
                          ? "bg-slate-300/8"
                          : index === 2
                            ? "bg-orange-700/20"
                            : "";

                    return (
                      <tr key={row.id} className={cn("border-b border-white/6", topClass)}>
                        <td className="px-4 py-3">
                          <PositionBadge position={index + 1} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="relative h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-white/10">
                              {avatar ? (
                                <Image src={avatar} alt={displayName} fill sizes="36px" className="object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-xs font-bold text-cyan-200">
                                  {displayName.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                            </span>
                            <span className="font-medium text-slate-100">{displayName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.profile?.xbox_gamertag ?? "Não vinculado"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-300">{row.points}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {row.wins} / {row.losses}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
        <Trophy className="h-3.5 w-3.5" /> 1º
      </span>
    );
  }

  if (position === 2) {
    return <span className="rounded-full border border-slate-300/40 bg-slate-300/15 px-2.5 py-1 text-xs font-semibold text-slate-200">2º</span>;
  }

  if (position === 3) {
    return <span className="rounded-full border border-orange-400/40 bg-orange-400/15 px-2.5 py-1 text-xs font-semibold text-orange-200">3º</span>;
  }

  return <span className="text-sm text-slate-400">#{position}</span>;
}
