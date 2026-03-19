import Link from "next/link";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { Anchor, Calendar, Coins, Flame, Trophy, Users } from "lucide-react";   
import madnessArenaBackground from "../madness_arena_background_hero.jpg";

import { formatTeamSize } from "@/lib/events";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicServerClient } from "@/lib/supabase/public-server";
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
  return await getCachedHomeData();
}

export default async function Home() {
  const { featuredEvent, finishedEvents } = await getHomeData();
  const dict = await getDictionary();
  const locale = await getLocale();
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" });

  return (
    <main className="page-shell">

      <section className="hero-shell relative overflow-hidden border-b border-slate-200/60 dark:border-white/10 bg-[#ecf4fa] dark:bg-[#050b12]">
        <div
          aria-hidden
          className="absolute inset-0 dark:hidden bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.32),transparent_42%),radial-gradient(circle_at_88%_12%,rgba(14,165,233,0.2),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(14,116,144,0.14),transparent_48%),radial-gradient(circle_at_92%_85%,rgba(251,191,36,0.16),transparent_30%),linear-gradient(180deg,rgba(226,244,255,0.95)_0%,rgba(210,230,245,0.88)_52%,rgba(235,246,255,0.94)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden dark:block bg-[radial-gradient(circle_at_10%_15%,rgba(34,211,238,0.22),transparent_40%),radial-gradient(circle_at_86%_12%,rgba(245,158,11,0.16),transparent_35%),radial-gradient(circle_at_55%_100%,rgba(56,189,248,0.12),transparent_52%),linear-gradient(180deg,rgba(4,16,35,0.92)_0%,rgba(3,11,26,0.96)_55%,rgba(2,8,20,1)_100%)]"
        />
        <div aria-hidden className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03] [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div aria-hidden className="absolute inset-0">
          <Image
            src={madnessArenaBackground}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="object-cover object-[center_22%] scale-[1.01] opacity-62 dark:opacity-68 saturate-[1.16] contrast-[1.08] brightness-[0.94] dark:brightness-[0.84]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,22,0.62)_0%,rgba(3,10,22,0.38)_38%,rgba(2,8,20,0.7)_100%)] dark:bg-[linear-gradient(180deg,rgba(2,8,20,0.54)_0%,rgba(2,8,20,0.3)_40%,rgba(2,8,20,0.7)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(56,189,248,0.15),transparent_44%),radial-gradient(circle_at_50%_120%,rgba(2,132,199,0.26),transparent_58%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.18),transparent_46%),radial-gradient(circle_at_50%_115%,rgba(14,116,144,0.36),transparent_60%)]" />
        </div>
        <div className="relative mx-auto flex flex-col items-center text-center max-w-5xl gap-8 px-4 sm:px-6 py-20 sm:py-28 lg:px-10 lg:py-32">     
          <div className="space-y-6 flex flex-col items-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/40 dark:border-cyan-300/50 bg-cyan-50/90 dark:bg-cyan-500/15 backdrop-blur-md px-3.5 py-1.5 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider sm:tracking-[0.22em] text-cyan-700 dark:text-cyan-100 shadow-xl shadow-cyan-900/10 dark:shadow-cyan-900/20">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500 dark:bg-cyan-200 animate-pulse" />
              <span className="truncate whitespace-normal">{dict.home.heroSubtitle}</span>
            </div>

            <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-7xl lg:text-8xl drop-shadow-[0_10px_30px_rgba(2,8,20,0.65)]">
              {dict.home.heroTitle1}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 bg-clip-text text-transparent ml-0 sm:ml-4">
                {dict.home.heroTitle2}
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-100/90 dark:text-slate-300 sm:text-lg lg:text-xl drop-shadow-[0_4px_14px_rgba(2,8,20,0.55)]">
              {dict.home.heroDesc}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link href="/events" className="action-primary inline-flex items-center gap-2 rounded-xl px-6 sm:px-8 py-3 sm:py-4 text-base font-bold transition shadow-lg shadow-amber-900/20 hover:shadow-amber-500/30">
                <Flame className="h-5 w-5" />
                {dict.home.heroBtnEvents}
              </Link>
              <Link href="/profile/me?action=new-team#teams" className="action-secondary inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/20 bg-slate-100/95 dark:bg-white/10 backdrop-blur-md px-6 sm:px-8 py-3 sm:py-4 text-base font-semibold text-slate-900 dark:text-white transition hover:bg-white dark:hover:bg-white/20">
                <Users className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                {dict.home.heroBtnTeam}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1400px] space-y-16 sm:space-y-20 px-4 sm:px-6 py-12 sm:py-16 lg:px-10">

        <section>
          <SectionHeader eyebrow={dict.home.quickActions} title={dict.home.startHere} />  
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: <Users className="h-6 w-6" />,
                title: dict.home.createTeam,
                desc: dict.home.createTeamDesc,
                href: "/teams",
                cta: dict.home.openTeams,
              },
              {
                icon: <Anchor className="h-6 w-6" />,
                title: dict.home.chooseTournament,
                desc: dict.home.chooseTournamentDesc,
                href: "/events",
                cta: dict.home.openEvents,
              },
              {
                icon: <Trophy className="h-6 w-6" />,
                title: dict.home.trackRanking,
                desc: dict.home.trackRankingDesc,
                href: "/ranking",
                cta: dict.home.openRanking,
              },
            ].map(({ icon, title, desc, href, cta }) => (
              <article key={title} className="glass-card soft-ring rounded-2xl p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/8 text-cyan-400">
                  {icon}
                </span>
                <h3 className="mt-4 font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p> 
                <Link href={href} className="mt-5 inline-flex text-xs font-semibold text-cyan-300 transition hover:text-cyan-200">
                  {cta} 
                </Link>
              </article>
            ))}
          </div>
        </section>

        {featuredEvent ? (
          <section>
            <SectionHeader eyebrow={dict.home.nextTournament} title={dict.home.highlightArena} />
            <article className="glass-card soft-ring relative mt-6 overflow-hidden rounded-[2rem] p-8 lg:p-10">
              <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-500/6 blur-[80px]" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_auto]">     
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={featuredEvent.status} dict={dict.status} />
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmt.format(new Date(featuredEvent.start_date))}
                    </span>
                    {featuredEvent.end_date && (
                      <span className="text-xs text-slate-500">
                        {dict.home.until} {fmt.format(new Date(featuredEvent.end_date))}     
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
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">{dict.home.prize}</p>
                      <p className="mt-1.5 max-w-[220px] text-sm font-extrabold text-amber-200">{featuredEvent.prize_description}</p>
                    </div>
                  )}
                  <span className="rounded-full border border-slate-200/50 dark:border-white/10 px-3 py-1 text-xs text-slate-300">
                    {formatTeamSize(featuredEvent.team_size)}
                  </span>
                  <Link
                    href={"/events/"}
                    className="action-primary inline-flex items-center gap-2 rounded-xl px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-bold transition"
                  >
                    <Trophy className="h-4 w-4" />
                    {dict.home.seeDetails}
                  </Link>
                </div>
              </div>
            </article>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-dashed border-slate-200/50 dark:border-white/10 px-8 py-16 text-center">
            <Trophy className="mx-auto h-12 w-12 text-slate-600" />
            <h2 className="mt-4 text-xl font-bold text-slate-300">{dict.home.noActiveTornament}</h2>
            <p className="mt-2 text-sm text-slate-500">{dict.home.noActiveTornamentDesc}</p>
            <Link
              href="/events"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-white/8"
            >
              {dict.home.eventHistory}
            </Link>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between">
            <SectionHeader eyebrow={dict.home.history} title={dict.home.lastTournaments} />    
            <Link
              href="/events?status=finished"
              className="mb-1 shrink-0 text-sm text-cyan-300 transition hover:text-cyan-200"
            >
              {dict.home.seeAll} 
            </Link>
          </div>

          {finishedEvents.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">     
              {finishedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={"/events/"}
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
                    {dict.home.seeDetails} 
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200/50 dark:border-white/10 px-6 py-14 text-center">
              <p className="text-sm text-slate-500">{dict.home.noFinishedTourney}</p>
            </div>
          )}
        </section>

        <section className="glass-card soft-ring overflow-hidden rounded-[2rem] p-8 text-center lg:p-14">
          <Users className="mx-auto h-10 w-10 text-cyan-400/50" />
          <h2 className="mt-4 text-2xl font-bold text-white lg:text-3xl">{dict.home.readyForBattle}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-400">
            {dict.home.readyForBattleDesc}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/profile/me?action=new-team#teams" className="action-primary inline-flex items-center gap-2 rounded-xl px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-bold transition"> <Anchor className="h-4 w-4" /> {dict.home.heroBtnTeam}
            </Link>
            <Link href="/ranking" className="action-secondary inline-flex items-center gap-2 rounded-xl px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold transition">
              <Trophy className="h-4 w-4" />
              {dict.home.openRanking}
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string })  
{
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300/70">{eyebrow}</p>
      <h2 className="black-goth mt-1 text-2xl font-bold text-white">{title}</h2>
    </div>
  );
}

function StatusBadge({ status, dict }: { status: string, dict: Record<string, string> }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "active" && "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        status === "published" && "border border-amber-400/30 bg-amber-400/10 text-amber-300",
        status === "finished" && "border border-slate-400/30 bg-slate-400/10 text-slate-300",
      )}
    >
      {dict[status] ?? status}
    </span>
  );
}
