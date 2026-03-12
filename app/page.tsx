import Link from "next/link";
import { Anchor, Calendar, Coins, Skull, Trophy, Users } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type ActiveEventRow = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: "draft" | "active" | "finished";
  prize_pool: number;
};

type FinishedEventRow = {
  id: string;
  title: string;
  end_date: string | null;
  prize_pool: number;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  draft: "Em breve",
  finished: "Finalizado",
};

async function getHomeData() {
  if (!isSupabaseConfigured()) {
    return { featuredEvent: null, finishedEvents: [], teamCount: 0, eventCount: 0 };
  }

  const supabase = await createClient();

  const [
    { data: activeEvents },
    { data: finishedEvents },
    { count: teamCount },
    { count: eventCount },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, start_date, end_date, status, prize_pool")
      .in("status", ["active", "draft"])
      .order("start_date", { ascending: true })
      .limit(1),
    supabase
      .from("events")
      .select("id, title, end_date, prize_pool")
      .eq("status", "finished")
      .order("end_date", { ascending: false })
      .limit(6),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }),
  ]);

  return {
    featuredEvent: (activeEvents?.[0] as ActiveEventRow) ?? null,
    finishedEvents: (finishedEvents ?? []) as FinishedEventRow[],
    teamCount: teamCount ?? 0,
    eventCount: eventCount ?? 0,
  };
}

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });
const fmtMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function Home() {
  const { featuredEvent, finishedEvents, teamCount, eventCount } = await getHomeData();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      {/* ─── Destaque Principal ─── */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(120,180,255,0.12),transparent)]"
        />
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-6 py-20 text-center lg:px-10 lg:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
            <Skull className="h-3.5 w-3.5" />
            MadnessArena · Sea of Thieves
          </span>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            A arena dos mares.<br />
            <span className="text-amber-300">Prove seu valor.</span>
          </h1>

          <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Competições oficiais de Sea of Thieves. Forme sua tripulação, inscreva-se nos torneios
            e conquiste o tesouro dos mares.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              <Trophy className="h-4 w-4" />
              Ver Torneios
            </Link>
            <Link
              href="/teams"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              <Anchor className="h-4 w-4" />
              Criar Equipe
            </Link>
          </div>

          {/* Estatísticas */}
          <div className="mt-4 flex flex-wrap justify-center gap-8 text-sm text-slate-400">
            <span>
              <span className="text-2xl font-bold text-white">{teamCount}</span> equipes registradas
            </span>
            <span>
              <span className="text-2xl font-bold text-white">{eventCount}</span> torneios realizados
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl space-y-16 px-6 py-14 lg:px-10">
        {/* ─── Evento em Destaque ─── */}
        {featuredEvent ? (
          <section>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">
              Próximo Torneio
            </p>
            <article className="relative overflow-hidden rounded-[2rem] border border-amber-400/20 bg-gradient-to-br from-amber-950/30 via-slate-950/60 to-slate-950/80 p-8 shadow-2xl shadow-black/40 lg:p-10">
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 h-60 w-60 rounded-full bg-amber-400/5 blur-3xl"
              />
              <div className="relative grid gap-6 lg:grid-cols-[1fr_auto]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={featuredEvent.status} />
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmt.format(new Date(featuredEvent.start_date))}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white lg:text-3xl">{featuredEvent.title}</h2>
                  {featuredEvent.description ? (
                    <p className="max-w-2xl text-sm leading-7 text-slate-300">
                      {featuredEvent.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-start gap-4 lg:items-end">
                  {featuredEvent.prize_pool > 0 ? (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-3 text-center">
                      <p className="text-xs font-medium uppercase tracking-wider text-amber-300/70">
                        Premiação
                      </p>
                      <p className="mt-1 text-2xl font-bold text-amber-300">
                        {fmtMoney.format(featuredEvent.prize_pool)}
                      </p>
                    </div>
                  ) : null}
                  <Link
                    href={`/events/${featuredEvent.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                  >
                    Ver detalhes
                  </Link>
                </div>
              </div>
            </article>
          </section>
        ) : null}

        {/* ─── Torneios Finalizados ─── */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Histórico
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Últimos Torneios</h2>
            </div>
            <Link
              href="/events?status=finished"
              className="text-sm text-cyan-300 transition hover:text-cyan-200"
            >
              Ver todos →
            </Link>
          </div>

          {finishedEvents.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {finishedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group rounded-2xl border border-white/8 bg-white/4 p-5 transition hover:border-amber-400/30 hover:bg-amber-400/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-100 group-hover:text-white">
                      {event.title}
                    </h3>
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/60" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    {event.end_date ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {fmt.format(new Date(event.end_date))}
                      </span>
                    ) : null}
                    {event.prize_pool > 0 ? (
                      <span className="flex items-center gap-1 text-amber-300/70">
                        <Coins className="h-3 w-3" />
                        {fmtMoney.format(event.prize_pool)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-slate-500">
              Nenhum torneio finalizado ainda. O primeiro está por vir.
            </p>
          )}
        </section>

        {/* ─── Chamada para Ação ─── */}
        <section className="rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-cyan-950/30 to-slate-950/60 p-8 text-center lg:p-12">
          <Users className="mx-auto h-10 w-10 text-cyan-400/60" />
          <h2 className="mt-4 text-2xl font-bold text-white">Forme sua tripulação</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-300">
            Reúna seus aliados, crie sua equipe na arena e inscreva-se nos próximos torneios.
            Apenas capitães de equipes podem registrar participação.
          </p>
          <Link
            href="/teams"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            <Anchor className="h-4 w-4" />
            Ir para Equipes
          </Link>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = cn(
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
    status === "active" && "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    status === "draft" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
    status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-300",
  );
  return <span className={colorClass}>{STATUS_LABELS[status] ?? status}</span>;
}
