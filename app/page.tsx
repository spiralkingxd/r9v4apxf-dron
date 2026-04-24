import Link from "next/link";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { Anchor, Calendar, Coins, Flame, Trophy, Users, ArrowRight } from "lucide-react";   


import { formatTeamSize } from "@/lib/events";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { cn } from "@/lib/utils";
import { getDictionary, getLocale } from "@/lib/i18n";

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

const getCachedHomeData = unstable_cache(
  async () => {
    const supabase = createPublicServerClient();

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
  try {
    return await getCachedHomeData();
  } catch (error) {
    console.error("[home-data] fallback due to server error", error);
    return { featuredEvent: null, finishedEvents: [] };
  }
}

export default async function Home() {
  const { featuredEvent, finishedEvents } = await getHomeData();
  const dict = await getDictionary();
  const locale = await getLocale();
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" });
  const stats = [
    { label: "Torneios finalizados", value: String(finishedEvents.length), icon: <Trophy className="h-4 w-4" /> },
    { label: "Status da temporada", value: featuredEvent ? "Ativa" : "Aguardando", icon: <Flame className="h-4 w-4" /> },
    { label: "Premiação em destaque", value: featuredEvent?.prize_description ?? "Em anúncio", icon: <Coins className="h-4 w-4" /> },
    { label: "Formato principal", value: featuredEvent ? formatTeamSize(featuredEvent.team_size) : "Tripulação livre", icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <main className="page-shell bg-[#0a0f18] min-h-screen text-slate-200">

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-cyan-900/30 bg-[#050b12]">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/40 via-[#050b12] to-[#050b12] opacity-80"
        />
        <div aria-hidden className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] [background-size:64px_64px]" />
        
        <div aria-hidden className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 to-[#050b12] opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050b12]/60 via-[#050b12]/80 to-[#050b12]" />
        </div>

        <div className="relative z-10 mx-auto flex flex-col items-center text-center max-w-6xl gap-8 px-4 sm:px-6 py-24 sm:py-32 lg:px-10 lg:py-40">     
          <div className="space-y-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
            
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-cyan-400/30 bg-cyan-950/80 px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-cyan-200 shadow-lg shadow-cyan-900/20 transition-colors hover:bg-cyan-900 hover:border-cyan-400/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span>{dict.home.heroSubtitle}</span>
            </div>

            <div className="hero-title-wrap">
              <h1 className="max-w-5xl text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-7xl lg:text-8xl drop-shadow-2xl">
                {dict.home.heroTitle1}
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 bg-clip-text text-transparent sm:ml-4 inline-block drop-shadow-lg">
                  {dict.home.heroTitle2}
                </span>
              </h1>
            </div>

            <p className="max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl lg:text-2xl font-light">
              {dict.home.heroDesc}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-5 pt-8">
              <Link href="/events" className="group relative inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-slate-900 transition-all overflow-hidden bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.3)] hover:shadow-[0_0_40px_rgba(251,191,36,0.5)] transform hover:-translate-y-1">
                <div className="absolute inset-0 w-full h-full bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out" />
                <Flame className="h-5 w-5" />
                <span>{dict.home.heroBtnEvents}</span>
              </Link>
              <Link href="/profile/me?action=new-team#teams" className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-slate-900/80 px-8 py-4 text-base font-semibold text-cyan-50 transition-all hover:bg-slate-800 hover:border-cyan-500/60 shadow-lg transform hover:-translate-y-1">
                <Users className="h-5 w-5 text-cyan-400" />
                {dict.home.heroBtnTeam}
              </Link>
            </div>
          </div>
        </div>
        
        {/* Bottom gradient fade to content */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0f18] to-transparent z-10" />
      </section>

      <div className="mx-auto w-full max-w-[1400px] space-y-24 px-4 sm:px-6 py-16 lg:px-10 z-20 relative">
        
        {/* Stats Section */}
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 -mt-16 sm:-mt-24 relative z-30">
          {stats.map((item) => (
            <article key={item.label} className="group rounded-2xl border border-white/5 bg-slate-900/90 px-6 py-5 shadow-lg transition-transform hover:-translate-y-1 hover:border-cyan-500/30 hover:bg-slate-900">
              <div className="flex items-center gap-3 text-cyan-400">
                <div className="p-2 rounded-lg bg-cyan-950/50 group-hover:bg-cyan-900/50 transition-colors">
                  {item.icon}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 group-hover:text-cyan-200 transition-colors">{item.label}</p>
              </div>
              <p className="mt-4 text-2xl font-extrabold text-white tracking-tight">{item.value}</p>
            </article>
          ))}
        </section>

        {/* Info Cards */}
        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Rota do Competidor",
              desc: "Monte equipe, escolha torneio e acompanhe sua evolução no ranking da temporada.",
              href: "/teams",
              cta: "Começar agora",
              icon: <Anchor className="h-6 w-6" />,
              color: "cyan",
            },
            {
              title: "Calendário da Arena",
              desc: featuredEvent?.start_date
                ? `Próxima janela: ${fmt.format(new Date(featuredEvent.start_date))}.`
                : "Novas datas serão publicadas em breve no painel de eventos.",
              href: "/events",
              cta: "Ver calendário",
              icon: <Calendar className="h-6 w-6" />,
              color: "amber",
            },
            {
              title: "Objetivo da Semana",
              desc: "Entre nas partidas oficiais e acumule pontos para subir posições no ranking geral.",
              href: "/ranking",
              cta: "Ir ao ranking",
              icon: <Flame className="h-6 w-6" />,
              color: "emerald",
            },
          ].map((item) => (
            <article key={item.title} className="group relative rounded-3xl border border-white/5 bg-slate-900/40 p-8 transition-all duration-300 hover:bg-slate-800/60 hover:shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/10 blur-2xl rounded-full group-hover:bg-${item.color}-500/20 transition-all`} />
              
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-${item.color}-400/20 bg-${item.color}-500/10 text-${item.color}-400 mb-6 group-hover:scale-110 transition-transform`}>
                {item.icon}
              </span>
              <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400 mb-8">{item.desc}</p>
              
              <Link href={item.href} className={`inline-flex items-center gap-2 text-sm font-bold text-${item.color}-400 transition-colors hover:text-${item.color}-300 group/link`}>
                {item.cta}
                <ArrowRight className="h-4 w-4 transform group-hover/link:translate-x-1 transition-transform" />
              </Link>
            </article>
          ))}
        </section>

        {/* Featured Tournament */}
        {featuredEvent ? (
          <section>
            <SectionHeader eyebrow={dict.home.nextTournament} title={dict.home.highlightArena} />
            <article className="relative mt-8 overflow-hidden rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-br from-slate-900/80 to-black p-8 lg:p-12 shadow-[0_0_50px_rgba(245,158,11,0.05)]">
              <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-3xl" />
              <div className="relative grid gap-10 lg:grid-cols-[1fr_auto]">     
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <StatusBadge status={featuredEvent.status} dict={dict.status} />
                    <span className="flex items-center gap-2 text-sm font-medium text-amber-200/70">
                      <Calendar className="h-4 w-4" />
                      {fmt.format(new Date(featuredEvent.start_date))}
                    </span>
                    {featuredEvent.end_date && (
                      <span className="text-sm font-medium text-slate-500">
                        {dict.home.until} {fmt.format(new Date(featuredEvent.end_date))}     
                      </span>
                    )}
                  </div>
                  <h2 className="text-4xl font-extrabold text-white lg:text-5xl tracking-tight">{featuredEvent.title}</h2>
                  {featuredEvent.description && (
                    <div className="max-w-3xl prose prose-invert prose-sm prose-amber">
                      <MarkdownRenderer content={featuredEvent.description} />
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-start gap-6 lg:items-end justify-center bg-black/60 p-8 rounded-3xl border border-white/5">  
                  {featuredEvent.prize_description && (
                    <div className="text-center w-full">
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-500/80 mb-2">{dict.home.prize}</p>
                      <p className="text-2xl font-black text-amber-300 bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">{featuredEvent.prize_description}</p>
                    </div>
                  )}
                  <div className="w-full h-px bg-white/10 my-2" />
                  <span className="inline-flex items-center justify-center w-full rounded-xl border border-cyan-500/30 bg-cyan-950/50 px-4 py-2 text-sm font-bold text-cyan-200">
                    <Users className="h-4 w-4 mr-2 opacity-70" />
                    {formatTeamSize(featuredEvent.team_size)}
                  </span>
                  <Link
                    href={"/events/"}
                    className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 px-6 py-4 text-sm font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
                  >
                    <Trophy className="h-5 w-5" />
                    {dict.home.seeDetails}
                  </Link>
                </div>
              </div>
            </article>
          </section>
        ) : (
          <section className="rounded-[2.5rem] border border-dashed border-white/10 bg-slate-900/20 px-8 py-20 text-center">
            <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-800/50 mb-6">
              <Trophy className="h-10 w-10 text-slate-500" />
            </span>
            <h2 className="text-2xl font-bold text-white">{dict.home.noActiveTornament}</h2>
            <p className="mt-3 text-base text-slate-400 max-w-md mx-auto">{dict.home.noActiveTornamentDesc}</p>
            <Link
              href="/events"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-8 py-4 text-sm font-bold text-white transition hover:bg-white/10 hover:scale-105 transform"
            >
              {dict.home.eventHistory}
            </Link>
          </section>
        )}

        {/* History Section */}
        <section>
          <div className="flex items-end justify-between mb-8">
            <SectionHeader eyebrow={dict.home.history} title={dict.home.lastTournaments} />    
            <Link
              href="/events?status=finished"
              className="group flex items-center gap-2 text-sm font-bold text-cyan-400 transition hover:text-cyan-300"
            >
              {dict.home.seeAll} 
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {finishedEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">     
              {finishedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={"/events/"}
                  className="group flex flex-col justify-between rounded-3xl border border-white/5 bg-slate-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:bg-slate-800/60 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">      
                      <h3 className="font-bold text-lg text-slate-200 group-hover:text-white leading-tight">{event.title}</h3>
                      <div className="p-2 rounded-full bg-amber-500/10 text-amber-400 shrink-0">
                        <Trophy className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-400">
                      {event.end_date && (
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 opacity-50" />
                          {fmt.format(new Date(event.end_date))}
                        </span>
                      )}
                      {event.prize_description && (
                        <span className="flex items-center gap-2 text-amber-200/80">
                          <Coins className="h-4 w-4 opacity-70" />
                          <span className="font-semibold">{event.prize_description}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm font-bold text-cyan-500 transition-colors group-hover:text-cyan-400">
                    {dict.home.seeDetails} 
                    <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/20 px-6 py-20 text-center">
              <p className="text-base text-slate-500">{dict.home.noFinishedTourney}</p>
            </div>
          )}
        </section>

        {/* CTA Section */}
        <section className="relative overflow-hidden rounded-[3rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-950/80 to-[#050b12] p-10 text-center lg:p-20 shadow-[0_0_50px_rgba(34,211,238,0.05)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.1),transparent_50%)]" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-4 rounded-full bg-cyan-900/30 text-cyan-400 mb-6">
              <Users className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-extrabold text-white lg:text-4xl tracking-tight">{dict.home.readyForBattle}</h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-300">
              {dict.home.readyForBattleDesc}
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/profile/me?action=new-team#teams" className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-8 py-4 text-base font-bold transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transform hover:-translate-y-1">
                <Anchor className="h-5 w-5" /> 
                {dict.home.heroBtnTeam}
              </Link>
              <Link href="/ranking" className="inline-flex items-center gap-2 rounded-xl border border-cyan-700 bg-cyan-950/80 px-8 py-4 text-base font-bold text-cyan-50 transition-all hover:bg-cyan-900/90 hover:border-cyan-500 transform hover:-translate-y-1">
                <Trophy className="h-5 w-5" />
                {dict.home.openRanking}
              </Link>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string })  
{
  return (
    <div className="mb-8">
      <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-500 mb-2">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold text-white tracking-tight">{title}</h2>
    </div>
  );
}

function StatusBadge({ status, dict }: { status: string, dict: Record<string, string> }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider",
        status === "active" && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        status === "published" && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        status === "finished" && "bg-slate-500/20 text-slate-300 border border-slate-500/30",
      )}
    >
      <span className={cn("mr-2 h-1.5 w-1.5 rounded-full", status === "active" ? "bg-emerald-400 animate-pulse" : status === "published" ? "bg-amber-400" : "bg-slate-400")} />
      {dict[status] ?? status}
    </span>
  );
}
