"use client";

import { Calendar, Clock, Crown, Shield, Trophy } from "lucide-react";
import type { BracketMatchRow } from "@/app/admin/matches/_data";
import { cn } from "@/lib/utils";

// ─── Date Formatter ──────────────────────────────────────────────────────────

const dtFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

// ─── Status Config ────────────────────────────────────────────────────────────

type MatchStatus = BracketMatchRow["status"];

const STATUS_CONFIG: Record<
  MatchStatus,
  { label: string; dotClass: string; textClass: string; bgClass: string; borderClass: string }
> = {
  pending: {
    label: "Agendada",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-700 dark:text-emerald-300",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
    borderClass: "border-emerald-200 dark:border-emerald-800/40",
  },
  in_progress: {
    label: "Em andamento",
    dotClass: "bg-amber-400 animate-pulse",
    textClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-50 dark:bg-amber-900/20",
    borderClass: "border-amber-200 dark:border-amber-800/40",
  },
  finished: {
    label: "Finalizada",
    dotClass: "bg-slate-400",
    textClass: "text-slate-600 dark:text-slate-400",
    bgClass: "bg-slate-50 dark:bg-slate-800/40",
    borderClass: "border-slate-200 dark:border-slate-700/40",
  },
  cancelled: {
    label: "Cancelada",
    dotClass: "bg-rose-400",
    textClass: "text-rose-700 dark:text-rose-400",
    bgClass: "bg-rose-50 dark:bg-rose-900/20",
    borderClass: "border-rose-200 dark:border-rose-800/40",
  },
};

// ─── Team Slot ────────────────────────────────────────────────────────────────

interface TeamSlotProps {
  id: string | null;
  name: string;
  logoUrl: string | null;
  memberCount: number | null;
  seed: number | null;
  score: number;
  isWinner: boolean;
  isBye: boolean;
  showScore: boolean;
}

function TeamSlot({
  id,
  name,
  logoUrl,
  memberCount,
  seed,
  score,
  isWinner,
  isBye,
  showScore,
}: TeamSlotProps) {
  const isPending = !id;

  if (isBye) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300/60 bg-amber-50 dark:bg-amber-900/15 px-3 py-2">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-amber-300/50 bg-amber-100 dark:bg-amber-800/30 text-[10px] font-bold text-amber-700 dark:text-amber-200 uppercase tracking-wider">
          BYE
        </span>
        <span className="flex-1 text-xs font-semibold italic text-amber-700 dark:text-amber-300">
          Avanço automático
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
        isPending
          ? "border-dashed border-slate-300/60 dark:border-white/10 bg-transparent"
          : isWinner
            ? "border-emerald-400/50 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm shadow-emerald-400/10"
            : "border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-slate-800/40",
      )}
    >
      {/* Logo / placeholder */}
      {isPending ? (
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-slate-800/60">
          <Shield className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        </span>
      ) : logoUrl ? (
        <img
          src={logoUrl}
          alt={`Logo ${name}`}
          className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-1 ring-white/20"
        />
      ) : (
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase">
          {name.charAt(0)}
        </span>
      )}

      {/* Name + member count */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isWinner && <Crown className="h-3 w-3 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />}
          <span
            className={cn(
              "block truncate text-sm font-semibold leading-tight",
              isPending
                ? "italic text-slate-400 dark:text-slate-500"
                : isWinner
                  ? "text-emerald-800 dark:text-emerald-200"
                  : "text-slate-800 dark:text-slate-100",
            )}
          >
            {isPending ? "A definir" : name}
          </span>
        </div>
        {/* Seed + member count */}
        {!isPending && (seed !== null || memberCount !== null) && (
          <div className="mt-0.5 flex items-center gap-2">
            {seed !== null && (
              <span className="rounded px-1 py-px text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                #{seed}
              </span>
            )}
            {memberCount !== null && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {memberCount} {memberCount === 1 ? "membro" : "membros"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Score */}
      {showScore && (
        <span
          className={cn(
            "flex-shrink-0 min-w-[1.75rem] text-center text-base font-bold tabular-nums",
            isWinner ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ─── MatchCard Props ───────────────────────────────────────────────────────────

export interface MatchCardProps {
  match: BracketMatchRow;
  /** Highlight styling for the grand final */
  isFinal?: boolean;
  /** Show the scheduled date/time when available */
  showDate?: boolean;
  /** Override card width via Tailwind class (default: w-[240px]) */
  widthClass?: string;
  /** Click callback */
  onClick?: (matchId: string) => void;
  /** Extra class names */
  className?: string;
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

export function MatchCard({
  match,
  isFinal = false,
  showDate = true,
  widthClass = "w-[240px]",
  onClick,
  className,
}: MatchCardProps) {
  const statusCfg = STATUS_CONFIG[match.status];
  const showScore = match.status === "finished" || match.status === "in_progress";
  const isByeMatch = Boolean(match.winner_id && (!match.team_a_id || !match.team_b_id));
  const teamAIsWinner = Boolean(match.winner_id && match.winner_id === match.team_a_id);
  const teamBIsWinner = Boolean(match.winner_id && match.winner_id === match.team_b_id);

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border-2 bg-white dark:bg-slate-900",
        "shadow-md transition-all duration-200",
        // Final highlighting
        isFinal
          ? "border-yellow-400/70 shadow-lg shadow-yellow-500/15 ring-2 ring-yellow-400/25"
          : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-lg",
        // In-progress accent
        match.status === "in_progress" && !isFinal && "border-amber-400/50 shadow-amber-400/10",
        onClick && "cursor-pointer",
        widthClass,
        className,
      )}
      onClick={() => onClick?.(match.id)}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 border-b",
          isFinal
            ? "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 border-yellow-200/60 dark:border-yellow-800/30"
            : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-white/8",
        )}
      >
        {/* Position label */}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
          {match.bracket_position ?? `R${match.round}`}
        </span>

        {/* Badges row */}
        <div className="flex items-center gap-1">
          {match.round === 1 && (
            <span className="rounded-full border border-cyan-300/40 bg-cyan-100 dark:bg-cyan-800/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-200 select-none">
              Sorteado
            </span>
          )}
          {isFinal && (
            <span className="flex items-center gap-0.5 rounded-full border border-yellow-400/50 bg-yellow-100 dark:bg-yellow-800/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-yellow-700 dark:text-yellow-200 select-none">
              <Trophy className="h-2.5 w-2.5" />
              Final
            </span>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 p-2.5">
        {/* Team A slot */}
        <TeamSlot
          id={match.team_a_id}
          name={match.team_a_name}
          logoUrl={match.team_a_logo_url}
          memberCount={match.team_a_member_count}
          seed={match.team_a_seed ?? null}
          score={match.score_a}
          isWinner={teamAIsWinner}
          isBye={isByeMatch && match.team_a_id === null}
          showScore={showScore}
        />

        {/* VS divider */}
        <div className="flex items-center gap-2 px-1">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">
            vs
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        {/* Team B slot */}
        <TeamSlot
          id={match.team_b_id}
          name={match.team_b_name}
          logoUrl={match.team_b_logo_url}
          memberCount={match.team_b_member_count}
          seed={match.team_b_seed ?? null}
          score={match.score_b}
          isWinner={teamBIsWinner}
          isBye={isByeMatch && match.team_b_id === null}
          showScore={showScore}
        />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/8 px-3 py-2 bg-slate-50/60 dark:bg-slate-800/40">
        {/* Status indicator */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              statusCfg.bgClass,
              statusCfg.borderClass,
              statusCfg.textClass,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", statusCfg.dotClass)} />
            {statusCfg.label}
          </span>

          {/* Score summary when finished */}
          {match.status === "finished" && match.winner_id && (
            <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
              {match.score_a} – {match.score_b}
            </span>
          )}
        </div>

        {/* Scheduled date */}
        {showDate && match.scheduled_at && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>{dtFmt.format(new Date(match.scheduled_at))}</span>
          </div>
        )}

        {/* Sorteio date for round-1 when no scheduled_at */}
        {showDate && match.round === 1 && !match.scheduled_at && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>Sorteado em {dtFmt.format(new Date(match.created_at))}</span>
          </div>
        )}
      </footer>
    </article>
  );
}
