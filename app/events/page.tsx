import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Search, Trophy } from "lucide-react";

import { TournamentCard, type TournamentCardData } from "@/components/events/TournamentCard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import { cn } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Eventos",
};

type EventRow = {
  id: string;
  title: string;
  name: string;
  status: "registrations_open" | "check_in" | "started" | "finished";
  tournament_type: "1v1_elimination" | "free_for_all_points" | "tdm";
  crew_type: "solo_sloop" | "sloop" | "brig" | "galleon";
  prize: string;
  start_date: string;
  registration_deadline: string | null;
  max_teams: number | null;
};

const VALID_STATUSES = ["registrations_open", "check_in", "started", "finished"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  registrations_open: "Inscricoes abertas",
  check_in: "Check-in",
  started: "Em andamento",
  finished: "Finalizado",
};

const getCachedAllEvents = unstable_cache(
  async () => {
    const supabase = createPublicServerClient();
    const { data } = await supabase
      .from("events")
      .select("id, title, name, status, tournament_type, crew_type, prize, start_date, registration_deadline, max_teams")
      .eq("event_kind", "tournament")
      .in("status", ["registrations_open", "check_in", "started", "finished"])
      .order("start_date", { ascending: false });
    return (data ?? []) as EventRow[];
  },
  ["all-events-public"],
  { tags: ["events", "public-data"], revalidate: 300 },
);

async function getEventsData(status: StatusFilter | null) {
  if (!isSupabaseConfigured()) {
    return {
      events: [] as TournamentCardData[],
      stats: { total: 0, registrations_open: 0, check_in: 0, started: 0, finished: 0 },
    };
  }

  const allEvents = await getCachedAllEvents();
  const supabase = createPublicServerClient();
  const eventIds = allEvents.map((event) => event.id);
  const approvedCounts = new Map<string, number>();

  if (eventIds.length > 0) {
    const { data: approvedRows } = await supabase
      .from("registrations")
      .select("event_id")
      .eq("status", "approved")
      .in("event_id", eventIds);

    for (const row of approvedRows ?? []) {
      const eventId = String(row.event_id);
      approvedCounts.set(eventId, (approvedCounts.get(eventId) ?? 0) + 1);
    }
  }

  const allCards: TournamentCardData[] = allEvents.map((event) => ({
    ...event,
    approved_count: approvedCounts.get(event.id) ?? 0,
  }));

  const events = status ? allCards.filter((event) => event.status === status) : allCards;

  return {
    events,
    stats: {
      total: allCards.length,
      registrations_open: allCards.filter((event) => event.status === "registrations_open").length,
      check_in: allCards.filter((event) => event.status === "check_in").length,
      started: allCards.filter((event) => event.status === "started").length,
      finished: allCards.filter((event) => event.status === "finished").length,
    },
  };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EventsPage({ searchParams }: Props) {
  const dict = await getDictionary();
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = VALID_STATUSES.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : null;

  const { events, stats } = await getEventsData(status);

  return (
    <main className="page-shell">

      {/* ─── Page Hero ───────────────────────────────────────── */}
      <section className="section-hero">
        <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[500px] -translate-x-1/2 rounded-full bg-amber-500/6 blur-[90px]" />

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 lg:px-10 lg:py-20">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/8 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            {dict.events.badge}
          </div>

          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white lg:text-5xl">
              {dict.events.title}
            </h1>
            <p className="mt-3 max-w-xl text-base text-slate-400">
              {dict.events.desc}
            </p>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: dict.events.stats.total, value: stats.total, color: "text-white" },
              { label: "Inscricoes abertas", value: stats.registrations_open, color: "text-emerald-400" },
              { label: "Check-in", value: stats.check_in, color: "text-amber-400" },
              { label: "Em andamento", value: stats.started, color: "text-sky-400" },
              { label: dict.events.stats.finished, value: stats.finished, color: "text-slate-400" },
            ]
              .filter(({ label, value }) => Number(value) > 0 || label === "Total")
              .map(({ label, value, color }) => (
              <div key={label} className="glass-card soft-ring min-w-[80px] rounded-xl px-5 py-3 text-center">
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
        <div className="mb-7 flex flex-wrap gap-2">
          <FilterChip href="/events" active={!status}>Todos</FilterChip>
          <FilterChip href="/events?status=registrations_open" active={status === "registrations_open"}>Inscricoes abertas</FilterChip>
          <FilterChip href="/events?status=check_in" active={status === "check_in"}>Check-in</FilterChip>
          <FilterChip href="/events?status=started" active={status === "started"}>Em andamento</FilterChip>
          <FilterChip href="/events?status=finished" active={status === "finished"}>Finalizados</FilterChip>
        </div>

        {/* Contagem */}
        <p className="mb-5 text-sm text-slate-500">
          {events.length > 0
            ? `${events.length} evento${events.length !== 1 ? "s" : ""}${status ? ` · ${STATUS_LABELS[status]}` : ""}`
            : "Nenhum resultado"}
        </p>

        {/* Grid */}
        {events.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => <TournamentCard key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-24 text-center">
            <Search className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-4 font-semibold text-slate-400">{dict.events.noTournament}</p>
            <p className="mt-1 text-sm text-slate-600">
              {status
                ? `Nenhum evento com status "${STATUS_LABELS[status]}" encontrado.`
                : dict.events.noEventYet}
            </p>
            {status && (
              <Link
                href="/events"
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/8"
              >
                {dict.events.clearFilter}
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition",
        active
          ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
      )}
    >
      {children}
    </Link>
  );
}




