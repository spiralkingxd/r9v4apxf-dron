import Image from "next/image";
import { ExternalLink, Radio } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CommunityStreamer } from "@/lib/streamers/types";

export function StreamerCard({ streamer }: { streamer: CommunityStreamer }) {
  const isLive = streamer.is_live;

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 sm:p-5 transition-all",
        isLive
          ? "border-rose-500/40 bg-rose-500/10 shadow-[0_0_0_1px_rgba(244,63,94,0.25),0_0_24px_rgba(244,63,94,0.16)]"
          : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10">
          {streamer.avatar_url ? (
            <Image src={streamer.avatar_url} alt={streamer.display_name} fill sizes="56px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
              {streamer.display_name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white">{streamer.display_name}</h3>
            <span className="rounded-full border border-slate-200 dark:border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {streamer.platform}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                <Radio className="h-3 w-3" /> Ao vivo
              </span>
            ) : (
              <span className="rounded-full border border-slate-300/70 dark:border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Offline
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">@{streamer.username}</p>
        </div>
      </div>

      {streamer.bio ? (
        <p className="mt-3 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{streamer.bio}</p>
      ) : null}

      {isLive ? (
        <div className="mt-3 space-y-1 rounded-xl border border-rose-500/20 bg-black/15 p-3">
          {streamer.live_title ? <p className="line-clamp-2 text-sm font-medium text-slate-100">{streamer.live_title}</p> : null}
          <p className="text-xs text-slate-300">
            {streamer.live_game || "Categoria não informada"}
            {` • ${streamer.viewers.toLocaleString("pt-BR")} viewers`}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {streamer.tags.map((tag) => (
          <span
            key={`${streamer.id}-${tag.slug}`}
            className={cn(
              "rounded-full border px-2 py-1 text-[11px] font-semibold",
              tag.is_highlight || tag.slug === "madnessarena"
                ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"
                : "border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300",
            )}
          >
            {tag.name}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <a
          href={streamer.channel_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
            isLive
              ? "bg-rose-500 text-white hover:bg-rose-400"
              : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
          )}
        >
          Ir para o canal <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}
