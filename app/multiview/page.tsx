import type { Metadata } from "next";
import Link from "next/link";
import { MonitorUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getTwitchStreams } from "@/lib/twitch";
import { TwitchMultiviewGrid } from "@/components/twitch-multiview-grid";

export const metadata: Metadata = {
  title: "Multiview",
  description: "Visualize múltiplas transmissões da Twitch em grade dinâmica.",
};

async function getOnlineSelectedStreamers() {
  const supabase = await createClient();
  const { data: streamersRaw } = await supabase.from("streamers").select("*");
  const streamers = (streamersRaw ?? []) as Array<{
    id: string;
    username: string;
    is_official?: boolean;
    is_active?: boolean;
    active?: boolean;
    selected_for_multiview?: boolean;
  }>;

  const selected = streamers.filter((s) => {
    if (typeof s.is_active === "boolean") return s.is_active;
    if (typeof s.active === "boolean") return s.active;
    if (typeof s.selected_for_multiview === "boolean") return s.selected_for_multiview;
    return true;
  });

  const usernames = selected.map((s) => s.username).filter(Boolean);
  const live = await getTwitchStreams(usernames);
  const liveSet = new Set(live.map((item: { user_login: string }) => item.user_login.toLowerCase()));

  return selected.map((s) => ({
    id: String(s.id),
    username: String(s.username),
    isOfficial: Boolean(s.is_official),
    isOrganizer: s.username.toLowerCase() === "hwmalk",
    isLive: liveSet.has(s.username.toLowerCase()),
  }));
}

export default async function MultiviewPage() {
  const streamers = await getOnlineSelectedStreamers();

  return (
    <main className="min-h-screen px-2 py-3 md:px-3 md:py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm font-semibold text-cyan-200">
          <MonitorUp className="h-4 w-4" />
          Multiview Twitch
        </div>
        <Link
          href="/transmissoes"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          Voltar para Transmissões
        </Link>
      </div>

      <TwitchMultiviewGrid streamers={streamers} />
    </main>
  );
}
