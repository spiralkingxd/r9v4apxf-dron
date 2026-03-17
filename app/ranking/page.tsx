import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Anchor } from "lucide-react";

import { RankingLiveSync } from "@/components/ranking-live-sync";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import { unstable_cache } from "next/cache";
import { cn } from "@/lib/utils";
import { getDictionary, getLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: locale === "en" ? "Ranking" : "Ranking",
  };
}

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

const getCachedRanking = unstable_cache(
  async () => {
    const supabase = createPublicServerClient();

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
  },
  ["ranking-public-data"],
  { tags: ["ranking", "public-data"], revalidate: 3600 }
);

async function getRankingData() {
  if (!isSupabaseConfigured()) {
    return [] as Array<RankingRow & { profile: ProfileRow | null }>;
  }

  return await getCachedRanking();
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ boat?: string }> }) {
  const dict = await getDictionary();
  const resolvedParams = await searchParams;
  const currentBoat = resolvedParams.boat || "all";
  let rows = await getRankingData();

  // Temporary mock filter logic for visual purpose, until backend explicitly supports boat-based rankings.
  if (currentBoat !== "all") {
     // Currently we don't have this in the DB, so we just pass the rows. When DB is updated with team sizes, filter here.
  }

  return (
    <main className="page-shell px-6 py-10 lg:px-10">
      <RankingLiveSync />
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">{dict.ranking.badge}</p>
          <h1 className="mt-1 text-3xl font-bold text-white">{dict.ranking.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{dict.ranking.desc}</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
          {[
            { id: "all", label: dict.ranking.tabs.all },
            { id: "sloop", label: dict.ranking.tabs.sloop },
            { id: "brigantine", label: dict.ranking.tabs.brigantine },
            { id: "galleon", label: dict.ranking.tabs.galleon },
          ].map((tab) => (
            <Link
              key={tab.id}
              href={`?boat=${tab.id}`}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition",
                currentBoat === tab.id
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                  : "text-slate-400 border border-transparent hover:bg-white/5 hover:text-white"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-slate-400">
            {dict.ranking.empty}
          </section>
        ) : (
          <section className="glass-card soft-ring overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{dict.ranking.table.pos}</th>
                    <th className="px-4 py-3">{dict.ranking.table.pirate}</th>
                    <th className="px-4 py-3">{dict.ranking.table.xbox}</th>
                    <th className="px-4 py-3 text-right">{dict.ranking.table.points}</th>
                    <th className="px-4 py-3 text-right">{dict.ranking.table.winLoss}</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => {
                    const displayName = row.profile?.display_name ?? row.profile?.username ?? dict.ranking.player;
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
                          <PositionBadge position={index + 1} dict={dict} />
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
                          {row.profile?.xbox_gamertag ?? dict.ranking.unlinked}
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

function PositionBadge({ position, dict }: { position: number, dict: any }) {
  if (position === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
        <Trophy className="h-3.5 w-3.5" /> {dict.ranking.position1}
      </span>
    );
  }

  if (position === 2) {
    return <span className="rounded-full border border-slate-300/40 bg-slate-300/15 px-2.5 py-1 text-xs font-semibold text-slate-200">{dict.ranking.position2}</span>;
  }

  if (position === 3) {
    return <span className="rounded-full border border-orange-400/40 bg-orange-400/15 px-2.5 py-1 text-xs font-semibold text-orange-200">{dict.ranking.position3}</span>;
  }

  return <span className="text-sm text-slate-400">#{position}</span>;
}



