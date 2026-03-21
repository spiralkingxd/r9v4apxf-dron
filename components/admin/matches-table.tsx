"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Shuffle, Trophy, XCircle } from "lucide-react";

import { advanceWinner, createMatch, setMatchWinner } from "@/app/admin/match-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";
import type { AdminMatchRow } from "@/app/admin/matches/_data";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function statusTone(status: AdminMatchRow["status"]) {
  if (status === "finished") return "active" as const;
  if (status === "in_progress") return "info" as const;
  if (status === "cancelled") return "danger" as const;
  return "pending" as const;
}

function statusLabel(status: AdminMatchRow["status"]) {
  if (status === "finished") return "🟢 Finalizada";
  if (status === "in_progress") return "🔵 Em andamento";
  if (status === "cancelled") return "🔴 Cancelada";
  return "🟡 Pendente";
}

export function MatchesTable({
  rows,
  events,
  teams,
  initialFilters,
  detailBasePath = "/admin/matches",
}: {
  rows: AdminMatchRow[];
  events: Array<{ id: string; title: string }>;
  teams: Array<{ id: string; name: string }>;
  initialFilters?: {
    eventId?: string;
    status?: AdminMatchRow["status"] | "all";
    round?: string;
  };
  detailBasePath?: string;
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(initialFilters?.eventId ?? "all");
  const [roundFilter, setRoundFilter] = useState(initialFilters?.round ?? "all");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminMatchRow["status"]>(initialFilters?.status ?? "all");
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30">("all");
  const [pageSize, setPageSize] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const [newMatch, setNewMatch] = useState({
    eventId: events[0]?.id ?? "",
    teamAId: teams[0]?.id ?? "",
    teamBId: teams[1]?.id ?? teams[0]?.id ?? "",
    round: 1,
    scheduledAt: "",
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (eventFilter !== "all" && row.event_id !== eventFilter) return false;
      if (roundFilter !== "all" && String(row.round) !== roundFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (dateFilter !== "all") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - Number(dateFilter));
        const refDate = row.scheduled_at ? new Date(row.scheduled_at) : new Date(row.updated_at);
        if (refDate < cutoff) return false;
      }
      if (!query) return true;
      return row.team_a_name.toLowerCase().includes(query) || row.team_b_name.toLowerCase().includes(query);
    });
  }, [rows, search, eventFilter, roundFilter, statusFilter, dateFilter]);

  const columns: AdminTableColumn<AdminMatchRow>[] = [
    {
      key: "event",
      header: "Evento",
      sortable: true,
      accessor: (row) => row.event_title,
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.event_title}</span>,
    },
    {
      key: "round",
      header: "Round",
      sortable: true,
      accessor: (row) => row.round,
      render: (row) => <span>R{row.round}</span>,
    },
    {
      key: "teamA",
      header: "Equipe A",
      sortable: true,
      accessor: (row) => row.team_a_name,
      render: (row) => <span>{row.team_a_name}</span>,
    },
    {
      key: "teamB",
      header: "Equipe B",
      sortable: true,
      accessor: (row) => row.team_b_name,
      render: (row) => <span>{row.team_b_name}</span>,
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
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => <AdminBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</AdminBadge>,
    },
    {
      key: "date",
      header: "Data",
      sortable: true,
      accessor: (row) => row.scheduled_at ?? row.updated_at,
      render: (row) => (
        <span className="text-xs">
          {dateFmt.format(new Date(row.scheduled_at ?? row.updated_at))}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Link href={`${detailBasePath}/${row.id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
            Ver
          </Link>
          {row.status !== "finished" && row.team_a_id && row.team_b_id ? (
            <button
              type="button"
              className="rounded-lg border border-cyan-300/30 bg-cyan-100 dark:bg-cyan-300/10 px-2 py-1 text-xs text-cyan-900 dark:text-cyan-100 hover:bg-cyan-300/20"
              onClick={() =>
                startTransition(async () => {
                  const winner = row.score_a === row.score_b ? "draw" : row.score_a > row.score_b ? row.team_a_id! : row.team_b_id!;
                  const result = await setMatchWinner(row.id, winner);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  router.refresh();
                })
              }
            >
              <Trophy className="mr-1 inline h-3 w-3" />
              Finalizar
            </button>
          ) : null}
          {row.status === "finished" ? (
            <button
              type="button"
              className="rounded-lg border border-amber-300/30 bg-amber-100 dark:bg-amber-300/10 px-2 py-1 text-xs text-amber-900 dark:text-amber-100 hover:bg-amber-300/20"
              onClick={() =>
                startTransition(async () => {
                  const result = await advanceWinner(row.id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  router.refresh();
                })
              }
            >
              <Shuffle className="mr-1 inline h-3 w-3" />
              Avançar
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const rounds = [...new Set(rows.map((row) => row.round))].sort((a, b) => a - b);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Buscar equipe
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Evento
          <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Round
          <select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            {rounds.map((round) => (
              <option key={round} value={String(round)}>R{round}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="in_progress">Em andamento</option>
            <option value="finished">Finalizada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Data
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as typeof dateFilter)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todas</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
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

      <div className="flex justify-end">
        <AdminButton type="button" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="h-4 w-4" />
          Nova partida
        </AdminButton>
      </div>

      <AdminTable data={filtered} columns={columns} pageSize={pageSize} emptyText="Nenhuma partida encontrada." />

      <AdminModal open={createOpen} title="Criar partida" onClose={() => setCreateOpen(false)}>
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            Evento
            <select value={newMatch.eventId} onChange={(event) => setNewMatch((prev) => ({ ...prev, eventId: event.target.value }))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm">
              {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              Equipe A
              <select value={newMatch.teamAId} onChange={(event) => setNewMatch((prev) => ({ ...prev, teamAId: event.target.value }))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm">
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              Equipe B
              <select value={newMatch.teamBId} onChange={(event) => setNewMatch((prev) => ({ ...prev, teamBId: event.target.value }))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm">
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              Round
              <input type="number" min={1} value={newMatch.round} onChange={(event) => setNewMatch((prev) => ({ ...prev, round: Number(event.target.value) }))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              Data agendada
              <input type="datetime-local" value={newMatch.scheduledAt} onChange={(event) => setNewMatch((prev) => ({ ...prev, scheduledAt: event.target.value }))} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
            </label>
          </div>

          {newMatch.teamAId === newMatch.teamBId ? (
            <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">
              <XCircle className="mr-1 inline h-3 w-3" />
              Equipes devem ser diferentes.
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <AdminButton type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</AdminButton>
            <AdminButton
              type="button"
              disabled={isPending || newMatch.teamAId === newMatch.teamBId}
              onClick={() =>
                startTransition(async () => {
                  const result = await createMatch(newMatch.eventId, newMatch.teamAId, newMatch.teamBId, newMatch.round, newMatch.scheduledAt || null);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  if (!result.error) setCreateOpen(false);
                  router.refresh();
                })
              }
            >
              Criar partida
            </AdminButton>
          </div>
        </div>
      </AdminModal>
    </section>
  );
}
