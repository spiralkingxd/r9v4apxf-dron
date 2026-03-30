"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { CommunityStreamer } from "@/lib/streamers/types";
import { StreamerCard } from "@/components/streamers/streamer-card";

type Props = {
  initialRows: CommunityStreamer[];
  availableTags: Array<{ slug: string; name: string }>;
};

export function StreamersClient({ initialRows, availableTags }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "live" | "offline">("all");
  const [tag, setTag] = useState("all");

  const rows = useMemo(() => {
    return initialRows.filter((row) => {
      if (status === "live" && !row.is_live) return false;
      if (status === "offline" && row.is_live) return false;
      if (tag !== "all" && !row.tags.some((t) => t.slug === tag)) return false;
      if (query.trim().length > 0) {
        const haystack = `${row.display_name} ${row.username}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [initialRows, query, status, tag]);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 md:grid-cols-4">
        <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/25 px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou nick"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | "live" | "offline")}
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/25 px-3 py-2 text-sm outline-none"
        >
          <option value="all">Todos</option>
          <option value="live">Ao vivo</option>
          <option value="offline">Offline</option>
        </select>

        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/25 px-3 py-2 text-sm outline-none"
        >
          <option value="all">Todas as tags</option>
          {availableTags.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 px-6 py-12 text-center text-slate-600 dark:text-slate-300">
          Nenhum streamer encontrado com esse filtro.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <StreamerCard key={row.id} streamer={row} />
          ))}
        </div>
      )}
    </section>
  );
}
