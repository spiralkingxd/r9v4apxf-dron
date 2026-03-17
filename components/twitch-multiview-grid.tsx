"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

declare global {
  interface Window {
    Twitch?: {
      Player: new (elementId: string, options: Record<string, unknown>) => unknown;
    };
  }
}

type Streamer = {
  id: string;
  username: string;
  isOfficial?: boolean;
  isOrganizer?: boolean;
  isLive?: boolean;
};

function StreamerPlayer({ id, username }: { id: string; username: string }) {
  return (
    <div className="relative aspect-video w-full bg-black">
      <div id={`twitch-player-${id}`} className="absolute inset-0" data-channel={username.toLowerCase()} />
    </div>
  );
}

function StreamerOfflineCard({ username }: { username: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_60%)]" />
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
        <p className="text-lg font-bold text-white/90 md:text-xl">{username}</p>
        <span className="rounded-full border border-slate-500/40 bg-slate-800/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
          Offline
        </span>
      </div>
    </div>
  );
}

function getGridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 lg:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 6) return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  if (count <= 9) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export function TwitchMultiviewGrid({ streamers }: { streamers: Streamer[] }) {
  const router = useRouter();

  const ordered = useMemo(() => {
    return [...streamers].sort((a, b) => {
      const aHw = a.username.toLowerCase() === "hwmalk";
      const bHw = b.username.toLowerCase() === "hwmalk";
      if (aHw && !bHw) return -1;
      if (!aHw && bHw) return 1;
      return a.username.localeCompare(b.username);
    });
  }, [streamers]);

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    const liveStreamers = ordered.filter((s) => s.isLive);
    if (liveStreamers.length === 0) return;

    const scriptId = "twitch-embed-sdk";

    const mountPlayers = () => {
      if (!window.Twitch?.Player) return;
      const host = window.location.hostname;
      for (const streamer of liveStreamers) {
        const elementId = `twitch-player-${streamer.id}`;
        const container = document.getElementById(elementId);
        if (!container) continue;
        const currentChannel = container.getAttribute("data-channel");
        if (container.dataset.initialized === "true" && currentChannel === streamer.username.toLowerCase()) {
          continue;
        }
        container.innerHTML = "";
        new window.Twitch.Player(elementId, {
          width: "100%",
          height: "100%",
          channel: streamer.username,
          parent: [host, "localhost", "127.0.0.1", "madnessarena.vercel.app"],
          muted: true,
        });
        container.dataset.initialized = "true";
      }
    };

    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.Twitch?.Player) mountPlayers();
      else existing.addEventListener("load", mountPlayers, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://embed.twitch.tv/embed/v1.js";
    script.async = true;
    script.addEventListener("load", mountPlayers, { once: true });
    document.body.appendChild(script);
  }, [ordered]);

  const hasAnySelected = ordered.length > 0;
  const hasAnyLive = ordered.some((s) => s.isLive);

  if (!hasAnySelected) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
        Nenhum streamer selecionado pela administração está ao vivo no momento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hasAnyLive && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-100">
          Nenhum streamer selecionado pela administração está ao vivo no momento.
        </div>
      )}

      <div className={`grid gap-2 md:gap-3 ${getGridClass(ordered.length)}`}>
        {ordered.map((streamer) => {
          const isOrganizer = streamer.username.toLowerCase() === "hwmalk";
          return (
            <article
              key={streamer.id}
              className={[
                "overflow-hidden rounded-xl border bg-black/50",
                isOrganizer
                  ? "border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                  : "border-white/10",
              ].join(" ")}
            >
              <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs text-slate-300">
                <span className="font-semibold">{streamer.username}</span>
                {isOrganizer ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                    <Star className="h-3 w-3" /> Organizador
                  </span>
                ) : streamer.isOfficial ? (
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-300">
                    Oficial
                  </span>
                ) : null}
              </header>

              {streamer.isLive ? (
                <StreamerPlayer id={streamer.id} username={streamer.username} />
              ) : (
                <StreamerOfflineCard username={streamer.username} />
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
