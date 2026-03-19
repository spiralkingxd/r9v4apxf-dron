"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCcw } from "lucide-react";

import { recalculateAllRankings, revertMatchResult } from "@/app/admin/match-actions";
import { AdminAutocompleteInput } from "@/components/admin/admin-autocomplete-input";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";
import type { ResultRow } from "@/app/admin/matches/_data";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function ResultsTable({
  rows,
  initialFilters,
}: {
  rows: ResultRow[];
  initialFilters?: { eventId?: string };
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(initialFilters?.eventId ?? "all");
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30" | "90">("all");
  const [pageSize, setPageSize] = useState(25);
  const teamOptions = useMemo(
    () =>
      Array.from(new Set(rows.flatMap((row) => [row.team_a_name, row.team_b_name])))
        .map((name) => ({ id: name, title: name }))
        .slice(0, 100),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (eventFilter !== "all" && row.event_id !== eventFilter) return false;
      if (dateFilter !== "all") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - Number(dateFilter));
        const ref = new Date(row.ended_at ?? row.updated_at);
        if (ref < cutoff) return false;
      }
      if (!query) return true;
      return row.team_a_name.toLowerCase().includes(query) || row.team_b_name.toLowerCase().includes(query);
    });
  }, [rows, search, eventFilter, dateFilter]);

  const events = useMemo(
    () =>
      [...new Map(rows.map((row) => [row.event_id, row.event_title])).entries()].map(([id, title]) => ({ id, title })),
    [rows],
  );

  const columns: AdminTableColumn<ResultRow>[] = [
    {
      key: "event",
      header: "Evento",
      sortable: true,
      accessor: (row) => row.event_title,
      render: (row) => <span>{row.event_title}</span>,
    },
    {
      key: "round",
      header: "Round",
      sortable: true,
      accessor: (row) => row.round,
      render: (row) => <span>R{row.round}</span>,
    },
    {
      key: "teams",
      header: "Equipes",
      sortable: true,
      accessor: (row) => `${row.team_a_name} vs ${row.team_b_name}`,
      render: (row) => <span>{row.team_a_name} vs {row.team_b_name}</span>,
    },
    {
      key: "score",
      header: "Placar",
      sortable: true,
      accessor: (row) => `${row.score_a}:${row.score_b}`,
      render: (row) => <span className="font-semibold">{row.score_a} x {row.score_b}</span>,
    },
    {
      key: "winner",
      header: "Vencedor",
      sortable: true,
      accessor: (row) => row.winner_name,
      render: (row) => <span>{row.winner_name}</span>,
    },
    {
      key: "date",
      header: "Data",
      sortable: true,
      accessor: (row) => row.ended_at ?? row.updated_at,
      render: (row) => <span className="text-xs">{dateFmt.format(new Date(row.ended_at ?? row.updated_at))}</span>,
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
            onClick={() =>
              startTransition(async () => {
                const result = await revertMatchResult(row.id);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            Reverter
          </button>
        </div>
      ),
    },
  ];

  const stats = useMemo(() => {
    const total = filtered.length;
    const eventsCount = new Set(filtered.map((row) => row.event_id)).size;
    const goals = filtered.reduce((acc, row) => acc + row.score_a + row.score_b, 0);
    const avgGoals = total > 0 ? (goals / total).toFixed(2) : "0.00";
    return { total, eventsCount, goals, avgGoals };
  }, [filtered]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Buscar equipe
          <AdminAutocompleteInput
            placeholder="Digite 2 letras para buscar equipe..."
            localOptions={teamOptions}
            onQueryChange={setSearch}
            onSelect={(option) => setSearch(option.title)}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Evento
          <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Data
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as typeof dateFilter)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todas</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Página
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">Partidas finalizadas: <span className="font-semibold text-slate-900 dark:text-white">{stats.total}</span></div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">Eventos: <span className="font-semibold text-slate-900 dark:text-white">{stats.eventsCount}</span></div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">Gols totais: <span className="font-semibold text-slate-900 dark:text-white">{stats.goals}</span></div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">Média por partida: <span className="font-semibold text-slate-900 dark:text-white">{stats.avgGoals}</span></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href="/admin/results/export?format=csv" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/10">
          <Download className="h-4 w-4" />
          Exportar CSV
        </a>
        <a href="/admin/results/export?format=json" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/10">
          <Download className="h-4 w-4" />
          Exportar JSON
        </a>
        <AdminButton
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await recalculateAllRankings();
              pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
              router.refresh();
            })
          }
        >
          <RefreshCcw className="h-4 w-4" />
          Recalcular ranking
        </AdminButton>
      </div>

      <AdminTable data={filtered} columns={columns} pageSize={pageSize} emptyText="Nenhum resultado encontrado." />
    </section>
  );
}
