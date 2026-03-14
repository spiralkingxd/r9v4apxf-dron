"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Eye, Pause, Play, Trash2, Trophy } from "lucide-react";

import {
  activateEvent,
  deleteEvent,
  duplicateEvent,
  finalizeEvent,
  pauseEvent,
  publishEvent,
} from "@/app/admin/event-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_VALUES,
  formatEventKind,
  formatEventStatus,
  formatEventType,
  formatEventVisibility,
  formatTeamSize,
  formatTournamentFormat,
} from "@/lib/events";

export type AdminEventRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "active" | "paused" | "finished";
  event_kind: "event" | "tournament";
  event_type: "tournament" | "special" | "scrimmage";
  visibility: "public" | "private";
  start_date: string;
  end_date: string | null;
  team_size: number;
  prize_description: string | null;
  approved_registrations: number;
  pending_registrations: number;
  created_at: string;
  tournament_format: string | null;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function EventsTable({ rows }: { rows: AdminEventRow[] }) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminEventRow["status"]>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30" | "90">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AdminEventRow["event_type"]>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | AdminEventRow["visibility"]>("all");
  const [pageSize, setPageSize] = useState(25);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<AdminEventRow | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (typeFilter !== "all" && row.event_type !== typeFilter) return false;
      if (visibilityFilter !== "all" && row.visibility !== visibilityFilter) return false;
      if (dateFilter !== "all") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - Number(dateFilter));
        if (new Date(row.start_date) < cutoff) return false;
      }
      if (!query) return true;
      return row.title.toLowerCase().includes(query);
    });
  }, [rows, search, statusFilter, typeFilter, visibilityFilter, dateFilter]);

  const columns: AdminTableColumn<AdminEventRow>[] = [
    {
      key: "name",
      header: "Torneio",
      sortable: true,
      accessor: (row) => row.title,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-100">{row.title}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
            <span>{formatEventKind(row.event_kind)}</span>
            <span>{formatEventType(row.event_type)}</span>
            <span>{formatEventVisibility(row.visibility)}</span>
            <span>{formatTeamSize(row.team_size)}</span>
            {row.tournament_format ? <span>{formatTournamentFormat(row.tournament_format)}</span> : null}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => {
        const tone = row.status === "active"
          ? "active"
          : row.status === "published"
            ? "info"
            : row.status === "finished"
              ? "inactive"
              : row.status === "paused"
                ? "danger"
                : "pending";
        return <AdminBadge tone={tone}>{formatEventStatus(row.status)}</AdminBadge>;
      },
    },
    {
      key: "start",
      header: "Data início",
      sortable: true,
      accessor: (row) => row.start_date,
      render: (row) => <span className="text-xs">{dateFmt.format(new Date(row.start_date))}</span>,
    },
    {
      key: "end",
      header: "Data fim",
      sortable: true,
      accessor: (row) => row.end_date ?? "",
      render: (row) => <span className="text-xs">{row.end_date ? dateFmt.format(new Date(row.end_date)) : "-"}</span>,
    },
    {
      key: "registrations",
      header: "Equipes inscritas",
      sortable: true,
      accessor: (row) => row.approved_registrations,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-100">{row.approved_registrations}</p>
          <p className="text-xs text-slate-400">{row.pending_registrations} pendentes</p>
        </div>
      ),
    },
    {
      key: "prize",
      header: "Premiação",
      sortable: true,
      accessor: (row) => row.prize_description ?? "",
      render: (row) => <span className="line-clamp-2 text-xs text-slate-300">{row.prize_description ?? "-"}</span>,
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => {
        const editPath = `/admin/tournaments/${row.id}/edit`;
        const detailPath = `/admin/tournaments/${row.id}`;
        return (
          <div className="flex flex-wrap gap-1">
            <Link href={detailPath} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
              <Eye className="mr-1 inline h-3 w-3" />
              Detalhes
            </Link>
            <Link href={editPath} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
              Editar
            </Link>
            <Link href={`/admin/tournaments/${row.id}/bracket`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
              Bracket
            </Link>
            <Link href={`/admin/tournaments/${row.id}/registrations`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
              <Eye className="mr-1 inline h-3 w-3" />
              Inscrições
            </Link>
            <button
              type="button"
              className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-300/20"
              onClick={() =>
                startTransition(async () => {
                  const result = await duplicateEvent(row.id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  if (!result.error && result.data?.id) {
                    router.push(`/admin/tournaments/${result.data.id}/edit`);
                  }
                  router.refresh();
                })
              }
            >
              <CopyPlus className="mr-1 inline h-3 w-3" />
              Duplicar
            </button>
            {row.status === "draft" ? (
              <button
                type="button"
                className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-300/20"
                onClick={() =>
                  startTransition(async () => {
                    const result = await publishEvent(row.id);
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                    router.refresh();
                  })
                }
              >
                <Play className="mr-1 inline h-3 w-3" />
                Publicar
              </button>
            ) : null}
            {row.status === "published" || row.status === "paused" ? (
              <button
                type="button"
                className="rounded-lg border border-lime-300/30 bg-lime-300/10 px-2 py-1 text-xs text-lime-100 hover:bg-lime-300/20"
                onClick={() =>
                  startTransition(async () => {
                    const result = await activateEvent(row.id);
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                    router.refresh();
                  })
                }
              >
                <Play className="mr-1 inline h-3 w-3" />
                Ativar
              </button>
            ) : null}
            {(row.status === "published" || row.status === "active") ? (
              <button
                type="button"
                className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100 hover:bg-amber-300/20"
                onClick={() =>
                  startTransition(async () => {
                    const result = await pauseEvent(row.id);
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                    router.refresh();
                  })
                }
              >
                <Pause className="mr-1 inline h-3 w-3" />
                Pausar
              </button>
            ) : null}
            {row.status !== "finished" ? (
              <button
                type="button"
                className="rounded-lg border border-fuchsia-300/30 bg-fuchsia-300/10 px-2 py-1 text-xs text-fuchsia-100 hover:bg-fuchsia-300/20"
                onClick={() =>
                  startTransition(async () => {
                    const result = await finalizeEvent(row.id);
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                    router.refresh();
                  })
                }
              >
                <Trophy className="mr-1 inline h-3 w-3" />
                Finalizar
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-xs text-rose-100 hover:bg-rose-300/20"
              onClick={() => setDeleteTarget(row)}
              disabled={isPending}
            >
              <Trash2 className="mr-1 inline h-3 w-3" />
              Deletar
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <section className="space-y-4">
      <div className="admin-surface flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Buscar por nome
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome do evento" className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100 outline-none" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todos</option>
            {EVENT_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>{EVENT_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Data
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as typeof dateFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todas</option>
            <option value="7">Próximos 7 dias</option>
            <option value="30">Próximos 30 dias</option>
            <option value="90">Próximos 90 dias</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Subtipo
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todos</option>
            <option value="special">Evento Especial</option>
            <option value="scrimmage">Scrimmage</option>
            <option value="tournament">Torneio</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Visibilidade
          <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todas</option>
            <option value="public">Pública</option>
            <option value="private">Privada</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Página
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <Link href="/admin/tournaments/new">
          <AdminButton>Novo torneio</AdminButton>
        </Link>
      </div>

      <AdminTable data={filtered} columns={columns} pageSize={pageSize} emptyText="Nenhum evento encontrado." />

      <AdminModal open={Boolean(deleteTarget)} title="Excluir evento" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Esta ação remove o evento e os dados relacionados, incluindo inscrições, partidas e notificações.
          </p>
          <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {deleteTarget?.title}
          </p>
          <div className="flex justify-end gap-3">
            <AdminButton type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </AdminButton>
            <AdminButton
              type="button"
              variant="danger"
              onClick={() =>
                startTransition(async () => {
                  if (!deleteTarget) return;
                  const result = await deleteEvent(deleteTarget.id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  if (!result.error) setDeleteTarget(null);
                  router.refresh();
                })
              }
            >
              Confirmar exclusão
            </AdminButton>
          </div>
        </div>
      </AdminModal>
    </section>
  );
}
