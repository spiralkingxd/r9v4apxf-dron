"use client";

import { useMemo } from "react";
import { Crown } from "lucide-react";
import type { BracketMatchRow } from "@/app/admin/matches/_data";
import { cn } from "@/lib/utils";

interface DoubleEliminationLayoutProps {
  matches: BracketMatchRow[];
  onMatchClick?: (matchId: string) => void;
}

const CARD_HEIGHT = 100;
const CARD_GAP = 10;
const ROUND_WIDTH = 300;
const ROUND_GAP = 50;
const CARD_WIDTH = 250;

/**
 * Separate matches into winners bracket and losers bracket
 */
function separateBrackets(matches: BracketMatchRow[]) {
  const winnersBracket: BracketMatchRow[] = [];
  const losersBracket: BracketMatchRow[] = [];
  const final: BracketMatchRow | null = null;

  for (const match of matches) {
    // For now, we'll use a simple heuristic:
    // All matches go to winners bracket (full double elim would need more schema info)
    winnersBracket.push(match);
  }

  return { winnersBracket, losersBracket, final };
}

export function DoubleEliminationLayout({
  matches,
  onMatchClick,
}: DoubleEliminationLayoutProps) {
  const { winnersBracket, losersBracket } = useMemo(() => separateBrackets(matches), [matches]);

  const groupedWinners = useMemo(() => {
    const map = new Map<number, BracketMatchRow[]>();
    for (const match of winnersBracket) {
      if (!map.has(match.round)) map.set(match.round, []);
      map.get(match.round)!.push(match);
    }
    return map;
  }, [winnersBracket]);

  const groupedLosers = useMemo(() => {
    const map = new Map<number, BracketMatchRow[]>();
    for (const match of losersBracket) {
      if (!map.has(match.round)) map.set(match.round, []);
      map.get(match.round)!.push(match);
    }
    return map;
  }, [losersBracket]);

  if (matches.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/10">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Chaveamento dupla eliminação não disponível
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-auto rounded-2xl border border-slate-200 dark:border-white/10">
      {/* Winners Bracket (Top) */}
      <div className="border-b border-slate-200 dark:border-white/10 p-6">
        <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2">
          <span className="text-2xl">🏆</span> Chave da Vitória
        </h3>
        <div className="flex gap-12 overflow-x-auto pb-4">
          {Array.from(groupedWinners.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([round, roundMatches]) => (
              <div key={`winners-${round}`} className="shrink-0">
                <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3">
                  Rodada {round}
                </h4>
                <div className="space-y-2">
                  {roundMatches.map((match) => (
                    <div
                      key={match.id}
                      onClick={() => onMatchClick?.(match.id)}
                      className="p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 text-xs hover:shadow-md transition-shadow"
                    >
                      <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {match.team_a_name || "TBD"}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[10px]">vs</div>
                      <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {match.team_b_name || "TBD"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Losers Bracket (Bottom) */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
          <span className="text-2xl">⚔️</span> Chave da Derrota
        </h3>
        {losersBracket.length > 0 ? (
          <div className="flex gap-12 overflow-x-auto pb-4">
            {Array.from(groupedLosers.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([round, roundMatches]) => (
                <div key={`losers-${round}`} className="shrink-0">
                  <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3">
                    Rodada {round}
                  </h4>
                  <div className="space-y-2">
                    {roundMatches.map((match) => (
                      <div
                        key={match.id}
                        onClick={() => onMatchClick?.(match.id)}
                        className="p-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-xs hover:shadow-md transition-shadow"
                      >
                        <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {match.team_a_name || "TBD"}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[10px]">vs</div>
                        <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {match.team_b_name || "TBD"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-450">
            Nenhuma partida na chave da derrota ainda
          </p>
        )}
      </div>
    </div>
  );
}
