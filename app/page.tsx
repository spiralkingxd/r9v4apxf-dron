import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Anchor, Calendar, Coins, Flame, Trophy, Users } from "lucide-react";

import { formatTeamSize } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type ActiveEventRow = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: "published" | "active" | "finished";
  prize_description: string | null;
  team_size: number;
};

type FinishedEventRow = {
  id: string;
  title: string;
  end_date: string | null;
  prize_description: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  published: "Publicado",
  finished: "Finalizado",
};

const getCachedHomeData = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    if (!supabase) {
      return { featuredEvent: null, finishedEvents: [] as FinishedEventRow[] };
    }

    const [{ data: activeEvents }, { data: finishedEvents }] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, description, start_date, end_date, status, prize_description, team_size")
        .in("status", ["active", "published"])
        .order("start_date", { ascending: true })
        .limit(1),
      supabase
        .from("events")
        .select("id, title, end_date, prize_description")
        .eq("status", "finished")
        .order("end_date", { ascending: false })
        .limit(6),
    ]);

    return {
      featuredEvent: (activeEvents?.[0] as ActiveEventRow) ?? null,
      finishedEvents: (finishedEvents ?? []) as FinishedEventRow[],
    };
  },
  ["home-public-data"],
  { revalidate: 45 },
);

async function getHomeData() {
  if (!isSupabaseConfigured()) {
    return { featuredEvent: null, finishedEvents: [] };
  }

  return await getCachedHomeData();
}
const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" });
export default async function Home() {
  const { featuredEvent, finishedEvents } = await getHomeData();

  return (
    <main className="page-shell">

      <section className="hero-shell relative overflow-hidden border-b border-white/10">
        <div className="relative mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-20">
          <div className="space-y-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/8 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Sea of Thieves · Temporada competitiva
            </div>

            <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
              A arena dos mares.
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Prove seu valor.
              </span>
            </h1>

            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Competições oficiais de Sea of Thieves. Monte sua tripulação,
              participe de torneios e conquiste o topo dos mares.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/events" className="action-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition">
                <Flame className="h-4 w-4" />
                Ver torneios
              </Link>
              <Link href="/profile/me?action=new-team#teams" className="action-secondary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition"> <Users className="h-4 w-4" /> Criar equipe
              </Link>
            </div>
          </div>

          <aside className="glass-card soft-ring h-fit rounded-2xl p-6 lg:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Resumo rápido</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Status atual</p>
                <p className="mt-1 text-sm font-semibold text-white">{featuredEvent ? "Torneio ativo/publicado" : "Sem torneio ativo"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Histórico</p>
                <p className="mt-1 text-sm font-semibold text-white">{finishedEvents.length} finalizado{finishedEvents.length === 1 ? "" : "s"}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl space-y-20 px-6 py-16 lg:px-10">

        <section>
          <SectionHeader eyebrow="Ações rápidas" title="Comece por aqui" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: <Users className="h-6 w-6" />,
                title: "Montar equipe",
                desc: "Crie ou organize sua tripulação para entrar nos campeonatos.",
                href: "/teams",
                cta: "Abrir equipes",
              },
              {
                icon: <Anchor className="h-6 w-6" />,
                title: "Escolher torneio",
                desc: "Veja eventos publicados e selecione o torneio certo para seu time.",
                href: "/events",
                cta: "Ver eventos",
              },
              {
                icon: <Trophy className="h-6 w-6" />,
                title: "Acompanhar ranking",
                desc: "Monitore sua evolução e compare desempenho com outras equipes.",
                href: "/ranking",
                cta: "Ver ranking",
              },
            ].map(({ icon, title, desc, href, cta }) => (
              <article key={title} className="glass-card soft-ring rounded-2xl p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/8 text-cyan-400">
                  {icon}
                </span>
                <h3 className="mt-4 font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
                <Link href={href} className="mt-5 inline-flex text-xs font-semibold text-cyan-300 transition hover:text-cyan-200">
                  {cta} →
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Torneio em Destaque ─────────────────────────────── */}
        {featuredEvent ? (
          <section>
            <SectionHeader eyebrow="Próximo Torneio" title="Destaque da Arena" />
            <article className="glass-card soft-ring relative mt-6 overflow-hidden rounded-[2rem] p-8 lg:p-10">
              <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-500/6 blur-[80px]" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_auto]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={featuredEvent.status} />
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmt.format(new Date(featuredEvent.start_date))}
                    </span>
                    {featuredEvent.end_date && (
                      <span className="text-xs text-slate-500">
                        até {fmt.format(new Date(featuredEvent.end_date))}
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-bold text-white lg:text-4xl">{featuredEvent.title}</h2>
                  {featuredEvent.description && (
                    <div className="prose prose-invert max-w-2xl text-sm leading-7 text-slate-300" dangerouslySetInnerHTML={{ __html: featuredEvent.description }} />
                  )}
                </div>
                <div className="flex flex-col items-start gap-4 lg:items-end">
                  {featuredEvent.prize_description && (
                    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/8 px-6 py-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">Premiação</p>
                      <p className="mt-1.5 max-w-[220px] text-sm font-extrabold text-amber-200">{featuredEvent.prize_description}</p>
                    </div>
                  )}
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {formatTeamSize(featuredEvent.team_size)}
                  </span>
                  <Link
                    href={`/events/${featuredEvent.id}`}
                    className="action-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition"
                  >
                    <Trophy className="h-4 w-4" />
                    Ver detalhes
                  </Link>
                </div>
              </div>
            </article>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-dashed border-white/10 px-8 py-16 text-center">
            <Trophy className="mx-auto h-12 w-12 text-slate-600" />
            <h2 className="mt-4 text-xl font-bold text-slate-300">Nenhum torneio ativo no momento</h2>
            <p className="mt-2 text-sm text-slate-500">Fique de olho — novos torneios são anunciados em breve.</p>
            <Link
              href="/events"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-white/8"
            >
              Ver histórico de torneios
            </Link>
          </section>
        )}

        {/* ─── Últimos Torneios ─────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between">
            <SectionHeader eyebrow="Histórico" title="Últimos Torneios" />
            <Link
              href="/events?status=finished"
              className="mb-1 shrink-0 text-sm text-cyan-300 transition hover:text-cyan-200"
            >
              Ver todos →
            </Link>
          </div>

          {finishedEvents.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {finishedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="glass-card soft-ring group flex flex-col rounded-2xl p-5 transition hover:border-amber-400/25"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-100 group-hover:text-white">{event.title}</h3>
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/50" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    {event.end_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {fmt.format(new Date(event.end_date))}
                      </span>
                    )}
                    {event.prize_description && (
                      <span className="flex items-center gap-1 text-amber-300/60">
                        <Coins className="h-3 w-3" />
                        {event.prize_description}
                      </span>
                    )}
                  </div>
                  <span className="mt-4 self-start text-xs font-medium text-cyan-300/60 transition group-hover:text-cyan-300">
                    Detalhes →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
              <p className="text-sm text-slate-500">Nenhum torneio finalizado ainda. O primeiro está por vir.</p>
            </div>
          )}
        </section>

        {/* ─── CTA Final ───────────────────────────────────────── */}
        <section className="glass-card soft-ring overflow-hidden rounded-[2rem] p-8 text-center lg:p-14">
          <Users className="mx-auto h-10 w-10 text-cyan-400/50" />
          <h2 className="mt-4 text-2xl font-bold text-white lg:text-3xl">Pronto para a batalha?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-400">
            Forme sua tripulação, inscreva-se nos torneios e comprove quem domina os mares.
            Cada partida conta para o ranking.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/profile/me?action=new-team#teams" className="action-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition"> <Anchor className="h-4 w-4" /> Criar equipe
            </Link>
            <Link href="/ranking" className="action-secondary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition">
              <Trophy className="h-4 w-4" />
              Ver ranking
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300/70">{eyebrow}</p>
      <h2 className="black-goth mt-1 text-2xl font-bold text-white">{title}</h2>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "active" && "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        status === "published" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
        status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-300",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}


