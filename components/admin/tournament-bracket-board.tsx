"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCcw, Shuffle, Sparkles } from "lucide-react";

import { advanceWinner, generateBracket, generateFirstRoundMatches, reorderBracketRound, resetBracket } from "@/app/admin/match-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";
import type { BracketMatchRow } from "@/app/admin/matches/_data";

type BracketFormat = "single_elimination" | "double_elimination" | "round_robin";

function getBracketOrderValue(position: string | null) {
  if (!position) return Number.MAX_SAFE_INTEGER;
  const match = /^R(\d+)-M(\d+)$/i.exec(position.trim());
  if (!match) return Number.MAX_SAFE_INTEGER - 1;
  return Number(match[1]) * 10_000 + Number(match[2]);
}

export function TournamentBracketBoard({
  eventId,
  eventTitle,
  matches,
}: {
  eventId: string;
  eventTitle: string;
  matches: BracketMatchRow[];
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [format, setFormat] = useState<BracketFormat>("single_elimination");
  const [dragState, setDragState] = useState<{ id: string; round: number } | null>(null);
  const [zoom, setZoom] = useState(100);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<number, BracketMatchRow[]>();
    for (const match of matches) {
      const list = map.get(match.round) ?? [];
      list.push(match);
      map.set(match.round, list);
    }
    for (const [round, list] of map.entries()) {
      map.set(
        round,
        [...list].sort((a, b) => {
          const posDiff = getBracketOrderValue(a.bracket_position) - getBracketOrderValue(b.bracket_position);
          if (posDiff !== 0) return posDiff;
          return a.created_at.localeCompare(b.created_at);
        }),
      );
    }
    return map;
  }, [matches]);

  const rounds = [...grouped.keys()].sort((a, b) => a - b);
  const finishedCount = matches.filter((match) => match.status === "finished").length;
  const dtFmt = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
    [],
  );

  function swapInRound(round: number, sourceId: string, targetId: string) {
    const roundList = [...(grouped.get(round) ?? [])];
    const sourceIndex = roundList.findIndex((match) => match.id === sourceId);
    const targetIndex = roundList.findIndex((match) => match.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const ids = roundList.map((match) => match.id);
    [ids[sourceIndex], ids[targetIndex]] = [ids[targetIndex], ids[sourceIndex]];

    startTransition(async () => {
      const result = await reorderBracketRound(eventId, round, ids);
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
      router.refresh();
    });
  }

  function beginPan(clientX: number, clientY: number) {
    if (!scrollRef.current) return;
    isPanning.current = true;
    panStart.current = {
      x: clientX,
      y: clientY,
      left: scrollRef.current.scrollLeft,
      top: scrollRef.current.scrollTop,
    };
  }

  function movePan(clientX: number, clientY: number) {
    if (!isPanning.current || !scrollRef.current || !panStart.current) return;
    const dx = clientX - panStart.current.x;
    const dy = clientY - panStart.current.y;
    scrollRef.current.scrollLeft = panStart.current.left - dx;
    scrollRef.current.scrollTop = panStart.current.top - dy;
  }

  function endPan() {
    isPanning.current = false;
    panStart.current = null;
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Bracket Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{eventTitle}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <AdminBadge tone="info">{`Progresso: ${finishedCount}/${matches.length} partidas`}</AdminBadge>
          <AdminBadge tone="pending">{`Formato: ${format}`}</AdminBadge>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4">
        <div className="flex flex-wrap gap-2">
          <select value={format} onChange={(event) => setFormat(event.target.value as BracketFormat)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="single_elimination">Single Elimination</option>
            <option value="double_elimination">Double Elimination</option>
            <option value="round_robin">Round Robin</option>
          </select>
          <AdminButton
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await generateFirstRoundMatches(eventId);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            <Shuffle className="h-4 w-4" />
            Sortear 1a fase
          </AdminButton>
          <AdminButton
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await generateBracket(eventId, format);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            <Sparkles className="h-4 w-4" />
            Gerar chaveamento
          </AdminButton>
          <AdminButton
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const ok = window.confirm("Resetar todo o bracket deste torneio?");
                if (!ok) return;
                const result = await resetBracket(eventId);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            <RefreshCcw className="h-4 w-4" />
            Resetar chaveamento
          </AdminButton>
          <Link href={`/admin/tournaments/${eventId}/bracket/export`} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/10">
            <Download className="h-4 w-4" />
            Exportar imagem (SVG)
          </Link>
          <Link href={`/admin/tournaments/${eventId}/bracket/export?format=pdf`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/10">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Link>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            Zoom
            <input
              type="range"
              min={60}
              max={140}
              step={5}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <span className="w-10 text-right text-xs">{zoom}%</span>
          </label>
        </div>
      </section>

      <section
        ref={scrollRef}
        className="overflow-auto pb-4"
        onMouseDown={(event) => beginPan(event.clientX, event.clientY)}
        onMouseMove={(event) => movePan(event.clientX, event.clientY)}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        <div className="flex min-w-max gap-6" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
          {rounds.map((round) => (
            <div key={round} className="w-[320px] shrink-0 space-y-3">
              <h2 className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-cyan-200">
                Rodada {round}
              </h2>

              {(grouped.get(round) ?? []).map((match) => (
                <article
                  key={match.id}
                  draggable
                  onDragStart={() => setDragState({ id: match.id, round })}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!dragState || dragState.round !== round) return;
                    swapInRound(round, dragState.id, match.id);
                    setDragState(null);
                  }}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">{match.bracket_position ?? "-"}</span>
                    <AdminBadge tone={match.status === "finished" ? "active" : match.status === "in_progress" ? "info" : match.status === "cancelled" ? "danger" : "pending"}>
                      {match.status}
                    </AdminBadge>
                  </div>

                  {match.round === 1 ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-100 dark:bg-cyan-300/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-cyan-900 dark:text-cyan-100">
                        Sorteado
                      </span>
                      <span className="text-slate-500">{dtFmt.format(new Date(match.created_at))}</span>
                    </div>
                  ) : null}

                  {match.winner_id && (match.team_a_id === null || match.team_b_id === null) ? (
                    <p className="mb-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-100">
                      BYE: avanço automático para próxima fase.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <div className={`rounded-lg border px-3 py-2 text-sm ${match.winner_id === match.team_a_id ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200" : "border-slate-200 dark:border-white/10 bg-white/5 text-slate-700 dark:text-slate-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 truncate">
                          {match.team_a_logo_url ? <img src={match.team_a_logo_url} alt="Logo equipe A" className="h-4 w-4 rounded-full object-cover" /> : null}
                          <span className="truncate">{match.team_a_name}</span>
                          {match.team_a_member_count ? <span className="text-[10px] text-slate-500">({match.team_a_member_count})</span> : null}
                        </span>
                        <span className="font-bold">{match.score_a}</span>
                      </div>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 text-sm ${match.winner_id === match.team_b_id ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200" : "border-slate-200 dark:border-white/10 bg-white/5 text-slate-700 dark:text-slate-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 truncate">
                          {match.team_b_logo_url ? <img src={match.team_b_logo_url} alt="Logo equipe B" className="h-4 w-4 rounded-full object-cover" /> : null}
                          <span className="truncate">{match.team_b_name}</span>
                          {match.team_b_member_count ? <span className="text-[10px] text-slate-500">({match.team_b_member_count})</span> : null}
                        </span>
                        <span className="font-bold">{match.score_b}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    <Link href={`/admin/tournaments/${eventId}/matches/${match.id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">Editar</Link>
                    {match.status === "finished" && match.winner_id ? (
                      <button
                        type="button"
                        className="rounded-lg border border-amber-300/30 bg-amber-100 dark:bg-amber-300/10 px-2 py-1 text-xs text-amber-900 dark:text-amber-100 hover:bg-amber-300/20"
                        onClick={() =>
                          startTransition(async () => {
                            const result = await advanceWinner(match.id);
                            pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                            router.refresh();
                          })
                        }
                      >
                        Avançar vencedor
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ))}
          {rounds.length === 0 ? <p className="text-sm text-slate-500">Nenhuma partida no bracket. Gere o chaveamento.</p> : null}
        </div>
      </section>
    </section>
  );
}
