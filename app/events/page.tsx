import Link from "next/link";
import { Suspense } from "react";
import { Calendar, Coins, Trophy } from "lucide-react";

import { EventStatusFilter } from "@/components/event-status-filter";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "finished";
  start_date: string;
  end_date: string | null;
  prize_pool: number;
};

const VALID_STATUSES = ["active", "draft", "finished"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  draft: "Em breve",
  finished: "Finalizado",
};

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });
const fmtMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function getEvents(status: StatusFilter | null) {
  if (!isSupabaseConfigured()) return [] as EventRow[];

  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id, title, description, status, start_date, end_date, prize_pool")
    .order("start_date", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return (data ?? []) as EventRow[];
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = VALID_STATUSES.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : null;

  const events = await getEvents(status);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-10 lg:px-10">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">
            Torneios
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">Eventos da Arena</h1>
          <p className="mt-2 text-sm text-slate-400">
            {events.length > 0
              ? `${events.length} evento${events.length !== 1 ? "s" : ""}${status ? ` · ${STATUS_LABELS[status]}` : ""}`
              : "Nenhum evento encontrado"}
          </p>
        </div>

        {/* Filters */}
        <Suspense fallback={null}>
          <EventStatusFilter />
        </Suspense>

        {/* Events grid */}
        {events.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group flex flex-col rounded-2xl border border-white/8 bg-white/4 p-5 transition hover:border-amber-400/30 hover:bg-amber-400/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-slate-100 group-hover:text-white">
                    {event.title}
                  </h2>
                  <StatusBadge status={event.status} />
                </div>

                {event.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                    {event.description}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmt.format(new Date(event.start_date))}
                  </span>
                  {event.prize_pool > 0 ? (
                    <span className="flex items-center gap-1 text-amber-300/80">
                      <Coins className="h-3 w-3" />
                      {fmtMoney.format(event.prize_pool)}
                    </span>
                  ) : null}
                </div>

                <span className="mt-4 self-start text-xs font-medium text-cyan-300 group-hover:text-cyan-200">
                  Ver detalhes →
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
            <Trophy className="mx-auto h-10 w-10 text-slate-500" />
            <p className="mt-4 text-sm text-slate-400">
              {status
                ? `Nenhum evento com status "${STATUS_LABELS[status]}" encontrado.`
                : "Nenhum evento cadastrado ainda."}
            </p>
            {status ? (
              <Link
                href="/events"
                className="mt-3 inline-flex text-sm text-cyan-300 hover:text-cyan-200"
              >
                Ver todos os eventos
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = cn(
    "shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
    status === "active" && "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    status === "draft" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
    status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-400",
  );
  return <span className={cls}>{STATUS_LABELS[status] ?? status}</span>;
}
