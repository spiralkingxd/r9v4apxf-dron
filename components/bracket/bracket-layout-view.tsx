"use client";

import { useState } from "react";
import { Grid3x3, LayoutList, Zap } from "lucide-react";
import { BracketVisualLayout } from "@/components/bracket/bracket-visual-layout";
import { DoubleEliminationLayout } from "@/components/bracket/double-elimination-layout";
import type { BracketMatchRow } from "@/app/admin/matches/_data";
import { cn } from "@/lib/utils";

interface BracketLayoutViewProps {
  matches: BracketMatchRow[];
  format?: "single_elimination" | "double_elimination";
}

export function BracketLayoutView({ matches, format = "single_elimination" }: BracketLayoutViewProps) {
  const [viewMode, setViewMode] = useState<"visual" | "double">("visual");

  return (
    <>
      {/* Layout selector buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setViewMode("visual")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            viewMode === "visual"
              ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-lg shadow-cyan-400/20"
              : "border border-slate-200 dark:border-white/10 bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-white/10",
          )}
        >
          <Grid3x3 className="h-4 w-4" />
          Visualização Professional
        </button>

        <button
          onClick={() => setViewMode("double")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            viewMode === "double"
              ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200 shadow-lg shadow-emerald-400/20"
              : "border border-slate-200 dark:border-white/10 bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-white/10",
          )}
        >
          <Zap className="h-4 w-4" />
          Dupla Eliminação
        </button>
      </div>

      {/* View content */}
      <div className="rounded-2xl bg-gradient-to-b from-white/5 to-transparent p-6">
        {viewMode === "visual" ? (
          <BracketVisualLayout matches={matches} format={format} />
        ) : (
          <DoubleEliminationLayout matches={matches} />
        )}
      </div>
    </>
  );
}
