import type { Metadata } from "next";

import { getCommunityStreamers, getCommunityTags } from "@/lib/streamers/queries";
import { StreamersClient } from "@/components/streamers/streamers-client";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Streamers da Comunidade",
  description: "Streamers da comunidade MadnessArena com status ao vivo, tags e canais oficiais.",
};

export default async function CommunityStreamersPage() {
  const [streamers, tags] = await Promise.all([
    getCommunityStreamers(),
    getCommunityTags(),
  ]);

  const liveCount = streamers.filter((s) => s.is_live).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
      <header className="mb-6 rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-sky-500/10 to-indigo-500/10 p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">Comunidade</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white md:text-4xl">Streamers MadnessArena</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Esta página exibe apenas criadores com a tag principal <strong>MadnessArena</strong>. A lista prioriza quem está ao vivo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-slate-300 dark:border-white/10 px-2.5 py-1 text-slate-700 dark:text-slate-300">
            {streamers.length} streamers
          </span>
          <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-rose-700 dark:text-rose-200">
            {liveCount} ao vivo
          </span>
        </div>
      </header>

      <StreamersClient initialRows={streamers} availableTags={tags} />
    </main>
  );
}
