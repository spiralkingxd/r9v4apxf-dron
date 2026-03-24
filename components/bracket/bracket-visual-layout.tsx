"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BracketMatchRow } from "@/app/admin/matches/_data";
import { cn } from "@/lib/utils";
import { MatchCard } from "@/components/bracket/match-card";

// ─── Layout constants ────────────────────────────────────────────────────────

/**
 * Height of one "bracket unit" — determines vertical spacing.
 * Compact spacing tuned for minimal match cards.
 */
const UNIT_H = 80;

/** Pixel height reserved for the round header column */
const HEADER_H = 68;

/** Card widths (px) per viewport breakpoint */
const CARD_W = { desktop: 196, tablet: 172, mobile: 152 } as const;

/** Column gap (px) per viewport breakpoint */
const COL_GAP = { desktop: 72, tablet: 60, mobile: 56 } as const;

function getCardWidthClass(vp: Viewport): "w-[196px]" | "w-[172px]" | "w-[152px]" {
  if (vp === "desktop") return "w-[196px]";
  if (vp === "tablet") return "w-[172px]";
  return "w-[152px]";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BracketVisualLayoutProps {
  matches: BracketMatchRow[];
  format?: "single_elimination" | "double_elimination" | "round_robin";
  isAdmin?: boolean;
  onMatchClick?: (matchId: string) => void;
  renderMatchCard?: (match: BracketMatchRow) => React.ReactNode;
}

type ConnectorTone = "base" | "final";

interface ConnectorPath {
  matchId: string;
  d: string;
  tone: ConnectorTone;
}

/** A virtual placeholder for a match that hasn't been created in the DB yet */
interface VirtualSlot {
  id: string;
  isVirtual: true;
  round: number;
  /** 0-based position index within the round column */
  slotIndex: number;
}

type LayoutSlot = BracketMatchRow | VirtualSlot;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function isVirtual(slot: LayoutSlot): slot is VirtualSlot {
  return (slot as VirtualSlot).isVirtual === true;
}

/**
 * Dynamic round label based on distance from the final.
 * fromEnd = 0 → Final, 1 → Semifinal, 2 → Quartas, 3 → Oitavas, etc.
 */
function getRoundLabel(round: number, totalRounds: number): { title: string; sub: string } {
  const fromEnd = totalRounds - round;
  const titles: Record<number, string> = {
    0: "Final",
    1: "Semifinal",
    2: "Quartas de Final",
    3: "Oitavas de Final",
  };
  return {
    title: titles[fromEnd] ?? `Rodada ${round}`,
    sub:
      fromEnd === 0
        ? "Grande final"
        : fromEnd === 1
          ? "Últimas 4 equipes"
          : fromEnd === 2
            ? "Últimas 8 equipes"
            : "",
  };
}

/** Infer the total number of bracket rounds from the round-1 match count. */
function calcTotalRounds(round1Count: number): number {
  if (round1Count <= 0) return 1;
  // round1Count = numTeams / 2, so numTeams = round1Count * 2
  // totalRounds = log2(numTeams)
  return Math.max(1, Math.round(Math.log2(round1Count * 2)));
}

/**
 * Expected number of match slots in round R for a bracket starting with
 * `round1Count` first-round matches.
 */
function expectedSlotsForRound(round: number, round1Count: number): number {
  return Math.max(1, Math.ceil(round1Count / Math.pow(2, round - 1)));
}

/**
 * Extract 0-based slot index from bracket_position (format "R1-M2" → 1).
 * Returns Infinity when position is absent (match will be appended).
 */
function slotIndexFromPosition(position: string | null): number {
  if (!position) return Infinity;
  const m = /R\d+-M(\d+)/i.exec(position.trim());
  return m ? Number(m[1]) - 1 : Infinity;
}

function isFinalMatch(match: BracketMatchRow, maxRound: number): boolean {
  return match.round === maxRound && !match.next_match_id;
}

// ─── Bracket slot layout ──────────────────────────────────────────────────────

/**
 * Build a complete slot list per round.
 *
 * - Real matches are placed at their bracket_position slot index.
 * - Missing positions are filled with VirtualSlot placeholders.
 * - Future rounds that have no DB matches get all-virtual columns.
 */
function buildRoundSlots(
  matches: BracketMatchRow[],
  totalRounds: number,
  round1Count: number,
): Map<number, LayoutSlot[]> {
  const map = new Map<number, LayoutSlot[]>();

  // Group real matches by round, sorted by bracket position
  const realByRound = new Map<number, BracketMatchRow[]>();
  for (const m of matches) {
    if (!realByRound.has(m.round)) realByRound.set(m.round, []);
    realByRound.get(m.round)!.push(m);
  }

  for (let round = 1; round <= totalRounds; round++) {
    const real = (realByRound.get(round) ?? []).sort(
      (a, b) => slotIndexFromPosition(a.bracket_position) - slotIndexFromPosition(b.bracket_position),
    );

    const expectedCount = expectedSlotsForRound(round, Math.max(round1Count, 1));

    // Map slot index → real match
    const slotMap = new Map<number, BracketMatchRow>();
    let nextAuto = 0;
    for (const m of real) {
      const idx = slotIndexFromPosition(m.bracket_position);
      const assigned = idx === Infinity ? nextAuto++ : idx;
      slotMap.set(assigned, m);
      if (idx !== Infinity) nextAuto = Math.max(nextAuto, assigned + 1);
    }

    const slots: LayoutSlot[] = [];
    for (let s = 0; s < expectedCount; s++) {
      if (slotMap.has(s)) {
        slots.push(slotMap.get(s)!);
        slotMap.delete(s);
      } else {
        slots.push({ id: `virtual-R${round}-S${s}`, isVirtual: true, round, slotIndex: s });
      }
    }
    // Append any extra real matches beyond expectedCount
    for (const m of slotMap.values()) {
      slots.push(m);
    }

    map.set(round, slots);
  }

  return map;
}

// ─── SVG connector builder ────────────────────────────────────────────────────

function buildConnectors(
  matches: BracketMatchRow[],
  cardRefs: Map<string, HTMLElement>,
  innerEl: HTMLElement,
  outerEl: HTMLElement,
  maxRound: number,
): ConnectorPath[] {
  const innerRect = innerEl.getBoundingClientRect();
  const scrollX = outerEl.scrollLeft;
  const scrollY = outerEl.scrollTop;

  function contentCoords(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return {
      left: r.left - innerRect.left + scrollX,
      top: r.top - innerRect.top + scrollY,
      right: r.right - innerRect.left + scrollX,
      width: r.width,
      height: r.height,
    };
  }

  const paths: ConnectorPath[] = [];

  for (const match of matches) {
    if (!match.next_match_id) continue;

    const srcEl = cardRefs.get(match.id);
    const dstEl = cardRefs.get(match.next_match_id);
    if (!srcEl || !dstEl) continue;

    const src = contentCoords(srcEl);
    const dst = contentCoords(dstEl);

    const x1 = src.right;
    const y1 = src.top + src.height / 2;
    const x2 = dst.left;
    const y2 = dst.top + dst.height / 2;
    const midX = (x1 + x2) / 2;

    // Minimal connector path: straight segments only (no curves)
    const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
    const nextMatch = matches.find((m) => m.id === match.next_match_id);
    const tone: ConnectorTone = nextMatch && isFinalMatch(nextMatch, maxRound) ? "final" : "base";

    paths.push({ matchId: match.id, d, tone });
  }

  return paths;
}

const CONNECTOR_CLASS: Record<ConnectorTone, string> = {
  base: "stroke-[#4B5563]",
  final: "stroke-[#374151]",
};

// ─── Ghost match card ─────────────────────────────────────────────────────────

/** Visual placeholder for a match that doesn't exist yet. */
function GhostMatchCard({ position, widthPx = 200 }: { position: number; widthPx?: number }) {
  return (
    <div
      className="overflow-hidden rounded-md border border-slate-200/80 bg-white/70 px-2.5 py-1.5 dark:border-white/10 dark:bg-slate-900/70"
      style={{ width: `${widthPx}px` }}
    >
      <div className="flex items-center justify-between py-1 text-[10px] text-slate-400 dark:text-slate-500">
        <span className="uppercase tracking-wider">Partida #{position}</span>
        <span>A definir</span>
      </div>

      <div className="h-px bg-slate-200/70 dark:bg-white/10" />

      <div className="py-1.5 text-sm italic text-slate-400 dark:text-slate-500">A definir</div>

      <div className="h-px bg-slate-200/70 dark:bg-white/10" />

      <div className="py-1.5 text-sm italic text-slate-400 dark:text-slate-500">A definir</div>
    </div>
  );
}

// ─── Viewport hook ─────────────────────────────────────────────────────────

type Viewport = "mobile" | "tablet" | "desktop";

function getVp(w: number): Viewport {
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() =>
    typeof window === "undefined" ? "desktop" : getVp(window.innerWidth),
  );
  useEffect(() => {
    const handler = () => setVp(getVp(window.innerWidth));
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return vp;
}

// ─── Mobile round navigator ───────────────────────────────────────────────────

interface MobileRoundNavProps {
  rounds: number[];
  roundSlots: Map<number, LayoutSlot[]>;
  totalRounds: number;
  maxRound: number;
  onMatchClick?: (matchId: string) => void;
  renderMatchCard?: (match: BracketMatchRow) => React.ReactNode;
  onSwitchToFull: () => void;
}

function MobileRoundNavigator({
  rounds,
  roundSlots,
  totalRounds,
  maxRound,
  onMatchClick,
  renderMatchCard,
  onSwitchToFull,
}: MobileRoundNavProps) {
  const [activeRound, setActiveRound] = useState(rounds[0] ?? 1);

  const safeActiveRound = rounds.includes(activeRound) ? activeRound : (rounds[0] ?? 1);
  const slots = roundSlots.get(safeActiveRound) ?? [];
  const mobileWidthClass = getCardWidthClass("mobile");
  const currentIdx = rounds.indexOf(safeActiveRound);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < rounds.length - 1;
  const { title, sub } = getRoundLabel(safeActiveRound, totalRounds);
  const isFinalRound = safeActiveRound === maxRound;

  return (
    <div className="flex flex-col gap-4">
      {/* Round tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {rounds.map((r) => {
          const { title: t } = getRoundLabel(r, totalRounds);
          return (
            <button
              key={r}
              onClick={() => setActiveRound(r)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                safeActiveRound === r
                  ? r === maxRound
                    ? "bg-yellow-400/20 text-yellow-500 dark:text-yellow-400 ring-1 ring-yellow-400/40"
                    : "bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Prev / round title / Next */}
      <div className="flex items-center justify-between px-1">
        <button
          aria-label="Round anterior"
          disabled={!canPrev}
          onClick={() => canPrev && setActiveRound(rounds[currentIdx - 1])}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 disabled:opacity-30 hover:enabled:bg-slate-100 dark:hover:enabled:bg-white/5 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="text-center">
          <p
            className={cn(
              "text-sm font-bold uppercase tracking-widest",
              isFinalRound
                ? "text-yellow-500 dark:text-yellow-400"
                : "text-slate-700 dark:text-slate-200",
            )}
          >
            {title}
          </p>
          {sub && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-0.5">
            {currentIdx + 1} / {rounds.length}
          </p>
        </div>

        <button
          aria-label="Próximo round"
          disabled={!canNext}
          onClick={() => canNext && setActiveRound(rounds[currentIdx + 1])}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 disabled:opacity-30 hover:enabled:bg-slate-100 dark:hover:enabled:bg-white/5 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Cards for the active round */}
      <div className="flex flex-col gap-3">
        {slots.map((slot, idx) => {
          if (isVirtual(slot)) {
            return (
              <GhostMatchCard
                key={slot.id}
                position={idx + 1}
                widthPx={CARD_W.mobile}
              />
            );
          }
          const match = slot as BracketMatchRow;
          return (
            <div
              key={match.id}
              className={cn(
                "transition-transform duration-150",
                onMatchClick && "cursor-pointer hover:scale-[1.01]",
              )}
            >
              {renderMatchCard
                ? renderMatchCard(match)
                : (
                  <MatchCard
                    match={match}
                    isFinal={isFinalMatch(match, maxRound)}
                    widthClass={mobileWidthClass}
                    onClick={onMatchClick}
                  />
                )}
            </div>
          );
        })}
      </div>

      {/* Escape to full bracket view */}
      <button
        onClick={onSwitchToFull}
        className="mt-2 self-center text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        Ver bracket completo →
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BracketVisualLayout({
  matches,
  format = "single_elimination",
  isAdmin = false,
  onMatchClick,
  renderMatchCard,
}: BracketVisualLayoutProps) {
  const viewport = useViewport();
  const [mobileOverride, setMobileOverride] = useState(false);

  // DOM refs
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // SVG connector state
  const [connectors, setConnectors] = useState<ConnectorPath[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 1200, h: 800 });

  // ── Bracket structure ───────────────────────────────────────────────────────

  /** Count of round-1 matches — determines the entire bracket shape. */
  const round1Count = useMemo(
    () => matches.filter((m) => m.round === 1).length,
    [matches],
  );

  const totalRounds = useMemo(() => {
    if (round1Count === 0 && matches.length > 0) {
      // Edge-case: no round-1 data; fall back to whatever rounds exist
      return Math.max(...matches.map((m) => m.round));
    }
    return calcTotalRounds(round1Count);
  }, [round1Count, matches]);

  /** All rounds from 1…totalRounds */
  const rounds = useMemo(
    () => Array.from({ length: totalRounds }, (_, i) => i + 1),
    [totalRounds],
  );

  const maxRound = totalRounds;

  /**
   * roundSlots: for each round, an ordered list of real matches + virtual
   * placeholders.  Virtual slots ensure the correct number of visible rows
   * even for future rounds or partially-populated rounds.
   */
  const roundSlots = useMemo(
    () => buildRoundSlots(matches, totalRounds, round1Count),
    [matches, totalRounds, round1Count],
  );

  const sideRounds = useMemo(
    () => rounds.filter((round) => round < maxRound),
    [rounds, maxRound],
  );

  const splitByRound = useMemo(() => {
    const map = new Map<number, { left: LayoutSlot[]; right: LayoutSlot[] }>();
    for (const round of sideRounds) {
      const slots = roundSlots.get(round) ?? [];
      const half = Math.ceil(slots.length / 2);
      map.set(round, {
        left: slots.slice(0, half),
        right: slots.slice(half),
      });
    }
    return map;
  }, [sideRounds, roundSlots]);

  const rightSideRounds = useMemo(
    () => [...sideRounds].reverse(),
    [sideRounds],
  );

  const centerSlots = useMemo(
    () => roundSlots.get(maxRound) ?? [],
    [roundSlots, maxRound],
  );

  /**
   * Side height for mirrored layout (left and right trees).
   * round-1 is split in half, one side for each finalist path.
   */
  const columnContentHeight = useMemo(() => {
    const split = splitByRound.get(1);
    const sideRound1Slots = split
      ? Math.max(split.left.length, split.right.length, 1)
      : Math.max(1, Math.ceil((roundSlots.get(1)?.length ?? Math.max(round1Count, 1)) / 2));
    return sideRound1Slots * UNIT_H;
  }, [splitByRound, roundSlots, round1Count]);

  const centerSlotHeight = useMemo(
    () => Math.max(UNIT_H, columnContentHeight / Math.max(centerSlots.length, 1)),
    [columnContentHeight, centerSlots.length],
  );

  // ── DOM measurement ────────────────────────────────────────────────────────

  const measure = useCallback(() => {
    if (viewport === "mobile" && !mobileOverride) {
      setConnectors([]);
      return;
    }

    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;

    setSvgSize({ w: inner.offsetWidth, h: inner.offsetHeight });
    setConnectors(buildConnectors(matches, cardRefs.current, inner, outer, maxRound));
  }, [matches, maxRound, viewport, mobileOverride]);

  useEffect(() => {
    if (viewport === "mobile" && !mobileOverride) return;
    const id = setTimeout(measure, 0);
    return () => clearTimeout(id);
  }, [measure, viewport, mobileOverride]);

  useEffect(() => {
    if (viewport === "mobile" && !mobileOverride) return;
    const observer = new ResizeObserver(measure);
    if (innerRef.current) observer.observe(innerRef.current);
    return () => observer.disconnect();
  }, [measure, viewport, mobileOverride]);

  const setCardRef = useCallback(
    (matchId: string) => (el: HTMLElement | null) => {
      if (el) cardRefs.current.set(matchId, el);
      else cardRefs.current.delete(matchId);
    },
    [],
  );

  // ── Empty state ──────────────────────────────────────────────────────────

  if (matches.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/10">
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Nenhuma partida no chaveamento
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Gere o chaveamento para visualizar o bracket
          </p>
        </div>
      </div>
    );
  }

  // ── Mobile: round-by-round navigator ────────────────────────────────────

  if (viewport === "mobile" && !mobileOverride) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4">
        <MobileRoundNavigator
          rounds={rounds}
          roundSlots={roundSlots}
          totalRounds={totalRounds}
          maxRound={maxRound}
          onMatchClick={onMatchClick}
          renderMatchCard={renderMatchCard}
          onSwitchToFull={() => setMobileOverride(true)}
        />
      </div>
    );
  }

  // ── Card sizing for tablet vs desktop ────────────────────────────────────

  const cardW = CARD_W[viewport] ?? CARD_W.desktop;
  const cardWidthClass = getCardWidthClass(viewport);
  const colGap = COL_GAP[viewport] ?? COL_GAP.desktop;

  function renderColumn(round: number, slots: LayoutSlot[], keyPrefix: string, slotHeight: number) {
    return (
      <div
        key={`${keyPrefix}-${round}`}
        className="shrink-0 flex flex-col"
        style={{
          width: `${cardW}px`,
          contentVisibility: "auto",
          containIntrinsicSize: "420px",
        }}
      >
        {/* Minimal visual top spacing: no heavy round metadata for clean bracket look */}
        <div style={{ height: `${HEADER_H}px` }} />

        <div className="flex flex-col" style={{ height: `${columnContentHeight}px` }}>
          {slots.map((slot, idx) => {
            if (isVirtual(slot)) {
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-start"
                  style={{ height: `${slotHeight}px` }}
                >
                  <GhostMatchCard position={idx + 1} widthPx={cardW} />
                </div>
              );
            }

            const match = slot as BracketMatchRow;
            const isFinal = isFinalMatch(match, maxRound);

            return (
              <div
                key={match.id}
                ref={setCardRef(match.id)}
                className={cn(
                  "flex items-center justify-start transition-transform duration-150",
                  onMatchClick && "cursor-pointer hover:scale-[1.02]",
                )}
                style={{ height: `${slotHeight}px` }}
              >
                {renderMatchCard
                  ? renderMatchCard(match)
                  : (
                    <MatchCard
                      match={match}
                      isFinal={isFinal}
                      widthClass={cardWidthClass}
                      onClick={onMatchClick}
                    />
                  )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render full bracket ─────────────────────────────────────────────────

  return (
    <div
      ref={outerRef}
      className="w-full overflow-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60"
    >
      {/* Inner content — w-max so it expands to fit all rounds */}
      <div ref={innerRef} className="relative w-max min-w-full">
        {/* ── SVG connector overlay ────────────────────────────────────────── */}
        {viewport !== "mobile" && (
          <svg
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-visible"
            width={svgSize.w}
            height={svgSize.h}
            style={{ zIndex: 0 }}
          >
            {connectors.map((conn) => {
              const isTablet = viewport === "tablet";
              const isFinalConn = conn.tone === "final";
              const strokeWidth = isFinalConn ? (isTablet ? 1.5 : 2) : 1;
              const opacity = isFinalConn ? (isTablet ? 0.6 : 0.72) : (isTablet ? 0.45 : 0.6);

              return (
                <path
                  key={conn.matchId}
                  d={conn.d}
                  fill="none"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                  opacity={opacity}
                  className={CONNECTOR_CLASS[conn.tone]}
                />
              );
            })}
          </svg>
        )}

        {/* ── Mirrored bracket columns (left tree -> center final <- right tree) ── */}
        <div className="relative flex px-4 sm:px-6 pt-6 pb-8" style={{ zIndex: 1, gap: `${colGap}px` }}>
          {sideRounds.map((round) => {
            const slots = splitByRound.get(round)?.left ?? [];
            const slotHeight = Math.pow(2, round - 1) * UNIT_H;
            return renderColumn(round, slots, "left", slotHeight);
          })}

          {renderColumn(maxRound, centerSlots, "center", centerSlotHeight)}

          {rightSideRounds.map((round) => {
            const slots = splitByRound.get(round)?.right ?? [];
            const slotHeight = Math.pow(2, round - 1) * UNIT_H;
            return renderColumn(round, slots, "right", slotHeight);
          })}
        </div>
      </div>
    </div>
  );
}
