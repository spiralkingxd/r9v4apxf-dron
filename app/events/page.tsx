import Link from "next/link";
import { Suspense } from "react";
import { Calendar, Coins, Search, Trophy } from "lucide-react";

import { EventStatusFilter } from "@/components/event-status-filter";
import { formatTeamSize } from "@/lib/events";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  status: "published" | "active" | "finished";
  start_date: string;
  end_date: string | null;
  prize_description: string | null;
  team_size: number;
};

const VALID_STATUSES = ["published", "active", "paused", "finished"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  published: "Publicado",
  paused: "Pausado",
  finished: "Finalizado",
};

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

async function getEvents(status: StatusFilter | null) {
  if (!isSupabaseConfigured()) return [] as EventRow[];

  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id, title, description, status, start_date, end_date, prize_description, team_size")
    .in("status", ["published", "active", "paused", "finished"])
    .order("start_date", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return (data ?? []) as EventRow[];
}

async function getAllEventStatuses() {
  if (!isSupabaseConfigured()) return { total: 0, active: 0, upcoming: 0, finished: 0 };

  const supabase = await createClient();
  const { data } = await supabase.from("events").select("status");
  const all = data ?? [];

  return {
    total: all.length,
    active: all.filter((e) => e.status === "active").length,
    upcoming: all.filter((e) => e.status === "published").length,
    paused: all.filter((e) => e.status === "paused").length,
    finished: all.filter((e) => e.status === "finished").length,
  };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = VALID_STATUSES.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : null;

  const [events, stats] = await Promise.all([getEvents(status), getAllEventStatuses()]);

  return (
    <main className="min-h-screen bg-[#050b12] text-slate-100">

      {/* ─── Page Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/8 bg-[radial-gradient(ellipse_100%_80%_at_50%_-10%,#0d2640_0%,#050b12_70%)]">
        <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[500px] -translate-x-1/2 rounded-full bg-amber-500/6 blur-[90px]" />

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 lg:px-10 lg:py-20">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/8 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            Competições Oficiais
          </div>

          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white lg:text-5xl">
              Torneios da Arena
            </h1>
            <p className="mt-3 max-w-xl text-base text-slate-400">
              Todos os torneios de Sea of Thieves organizados pela MadnessArena.
              Inscreva sua equipe e compita pela glória dos mares.
            </p>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Total", value: stats.total, color: "text-white" },
              { label: "Em andamento", value: stats.active, color: "text-emerald-400" },
              { label: "Publicados", value: stats.upcoming, color: "text-amber-400" },
              { label: "Pausados", value: stats.paused, color: "text-sky-400" },
              { label: "Finalizados", value: stats.finished, color: "text-slate-400" },
            ]
              .filter(({ label, value }) => Number(value) > 0 || label === "Total")
              .map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl border border-white/8 bg-white/4 px-5 py-3 text-center min-w-[80px]"
              >
                <p className={cn("text-2xl font-extrabold", color)}>{value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Listagem ────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">

        {/* Filtros */}
        <div className="mb-7">
          <Suspense fallback={null}>
            <EventStatusFilter />
          </Suspense>
        </div>

        {/* Contagem */}
        <p className="mb-5 text-sm text-slate-500">
          {events.length > 0
            ? `${events.length} torneio${events.length !== 1 ? "s" : ""}${status ? ` · ${STATUS_LABELS[status]}` : ""}`
            : "Nenhum resultado"}
        </p>

        {/* Grid */}
        {events.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group flex flex-col rounded-2xl border border-white/8 bg-white/3 p-6 transition hover:border-amber-400/25 hover:bg-amber-400/4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold leading-snug text-slate-100 group-hover:text-white">
                    {event.title}
                  </h2>
                  <StatusBadge status={event.status} />
                </div>

                {event.description && (
                  <div
                    className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400"
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                )}

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmt.format(new Date(event.start_date))}
                  </span>
                  {event.end_date && (
                    <span className="flex items-center gap-1">
                      até {fmt.format(new Date(event.end_date))}
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-400">
                    {formatTeamSize(event.team_size)}
                  </span>
                  {event.prize_description && (
                    <span className="flex items-center gap-1 text-amber-300/70">
                      <Coins className="h-3 w-3" />
                      {event.prize_description}
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-4">
                  <span className="text-xs font-medium text-cyan-300/60 transition group-hover:text-cyan-300">
                    Ver detalhes →
                  </span>
                  {event.status === "active" && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-24 text-center">
            <Search className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-4 font-semibold text-slate-400">Nenhum torneio encontrado</p>
            <p className="mt-1 text-sm text-slate-600">
              {status
                ? `Nenhum evento com status "${STATUS_LABELS[status]}" encontrado.`
                : "Nenhum evento cadastrado ainda."}
            </p>
            {status && (
              <Link
                href="/events"
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/8"
              >
                Limpar filtro
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "active" && "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        status === "published" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
        status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-400",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}


