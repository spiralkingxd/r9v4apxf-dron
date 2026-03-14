"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Plus, Trash2, X } from "lucide-react";

import {
  addWildcardRegistration,
  approveRegistration,
  bulkManageRegistrations,
  rejectRegistration,
  removeRegistration,
} from "@/app/admin/event-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";
import { REGISTRATION_STATUS_LABELS } from "@/lib/events";

type RegistrationRow = {
  team_id: string;
  team_name: string;
  captain_name: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  source: "self_service" | "wildcard";
  created_at: string;
  rejection_reason: string | null;
};

type TeamOption = {
  id: string;
  name: string;
  captain_name: string;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function EventRegistrationsTable({
  eventId,
  rows,
  availableTeams,
}: {
  eventId: string;
  rows: RegistrationRow[];
  availableTeams: TeamOption[];
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RegistrationRow["status"]>("all");
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reasonModal, setReasonModal] = useState<{ teamId: string | null; bulk: boolean }>({ teamId: null, bulk: false });
  const [reason, setReason] = useState("Fora dos critérios do evento.");
  const [wildcardOpen, setWildcardOpen] = useState(false);
  const [wildcardTeamId, setWildcardTeamId] = useState(availableTeams[0]?.id ?? "");
  const [deleteTarget, setDeleteTarget] = useState<RegistrationRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!query) return true;
      return row.team_name.toLowerCase().includes(query) || row.captain_name.toLowerCase().includes(query);
    });
  }, [rows, search, statusFilter]);

  const selectedIds = Object.entries(selected).filter(([, value]) => value).map(([id]) => id);

  const columns: AdminTableColumn<RegistrationRow>[] = [
    {
      key: "select",
      header: "Sel",
      render: (row) => (
        <input
          type="checkbox"
          checked={Boolean(selected[row.team_id])}
          onChange={(event) => setSelected((prev) => ({ ...prev, [row.team_id]: event.target.checked }))}
        />
      ),
    },
    {
      key: "team",
      header: "Equipe",
      sortable: true,
      accessor: (row) => row.team_name,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-100">{row.team_name}</p>
          <p className="text-xs text-slate-400">Capitão: {row.captain_name}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => {
        const tone = row.status === "approved"
          ? "active"
          : row.status === "rejected"
            ? "danger"
            : row.status === "cancelled"
              ? "inactive"
              : "pending";
        return <AdminBadge tone={tone}>{REGISTRATION_STATUS_LABELS[row.status]}</AdminBadge>;
      },
    },
    {
      key: "source",
      header: "Origem",
      sortable: true,
      accessor: (row) => row.source,
      render: (row) => <span className="text-xs text-slate-300">{row.source === "wildcard" ? "Wildcard" : "Equipe"}</span>,
    },
    {
      key: "created",
      header: "Solicitada em",
      sortable: true,
      accessor: (row) => row.created_at,
      render: (row) => <span className="text-xs">{dateFmt.format(new Date(row.created_at))}</span>,
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.status !== "approved" ? (
            <button
              type="button"
              className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-300/20"
              onClick={() =>
                startTransition(async () => {
                  const result = await approveRegistration(eventId, row.team_id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  router.refresh();
                })
              }
            >
              <Check className="mr-1 inline h-3 w-3" />
              Aprovar
            </button>
          ) : null}
          {row.status !== "rejected" ? (
            <button
              type="button"
              className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100 hover:bg-amber-300/20"
              onClick={() => {
                setReasonModal({ teamId: row.team_id, bulk: false });
                setReason(row.rejection_reason ?? "Fora dos critérios do evento.");
              }}
            >
              <X className="mr-1 inline h-3 w-3" />
              Rejeitar
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-xs text-rose-100 hover:bg-rose-300/20"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="mr-1 inline h-3 w-3" />
            Remover
          </button>
        </div>
      ),
    },
  ];

  function exportCsv() {
    window.open(`/admin/tournaments/${eventId}/registrations/export`, "_blank");
  }

  function runBulkApprove() {
    if (selectedIds.length === 0) {
      pushToast("info", "Selecione pelo menos uma inscrição.");
      return;
    }

    startTransition(async () => {
      const result = await bulkManageRegistrations(eventId, selectedIds, "approve");
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
      if (!result.error) setSelected({});
      router.refresh();
    });
  }

  function runBulkReject() {
    if (selectedIds.length === 0) {
      pushToast("info", "Selecione pelo menos uma inscrição.");
      return;
    }
    setReasonModal({ teamId: null, bulk: true });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Buscar equipe
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Equipe ou capitão" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Rejeitadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Página
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <AdminButton type="button" variant="success" disabled={isPending} onClick={runBulkApprove}>
          <Check className="h-4 w-4" />
          Aprovar em lote
        </AdminButton>
        <AdminButton type="button" variant="ghost" disabled={isPending} onClick={runBulkReject}>
          <X className="h-4 w-4" />
          Rejeitar em lote
        </AdminButton>
        <AdminButton type="button" variant="ghost" onClick={() => setWildcardOpen(true)} disabled={availableTeams.length === 0}>
          <Plus className="h-4 w-4" />
          Adicionar wildcard
        </AdminButton>
        <AdminButton type="button" variant="ghost" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </AdminButton>
        <span className="self-center text-xs text-slate-400">Selecionados: {selectedIds.length}</span>
      </div>

      <AdminTable data={filtered} columns={columns} pageSize={pageSize} emptyText="Nenhuma inscrição encontrada." />

      <AdminModal open={reasonModal.teamId !== null || reasonModal.bulk} title="Rejeitar inscrição" onClose={() => setReasonModal({ teamId: null, bulk: false })}>
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Motivo</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>
          <div className="flex justify-end gap-3">
            <AdminButton type="button" variant="ghost" onClick={() => setReasonModal({ teamId: null, bulk: false })}>
              Cancelar
            </AdminButton>
            <AdminButton
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const result = reasonModal.bulk
                    ? await bulkManageRegistrations(eventId, selectedIds, "reject", reason)
                    : await rejectRegistration(eventId, reasonModal.teamId ?? "", reason);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  if (!result.error) {
                    setReasonModal({ teamId: null, bulk: false });
                    setSelected({});
                  }
                  router.refresh();
                })
              }
            >
              Confirmar rejeição
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      <AdminModal open={wildcardOpen} title="Adicionar equipe manualmente" onClose={() => setWildcardOpen(false)}>
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Equipe</span>
            <select value={wildcardTeamId} onChange={(event) => setWildcardTeamId(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name} · {team.captain_name}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-3">
            <AdminButton type="button" variant="ghost" onClick={() => setWildcardOpen(false)}>
              Cancelar
            </AdminButton>
            <AdminButton
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const result = await addWildcardRegistration(eventId, wildcardTeamId);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  if (!result.error) setWildcardOpen(false);
                  router.refresh();
                })
              }
            >
              Confirmar wildcard
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      <AdminModal open={Boolean(deleteTarget)} title="Remover inscrição" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-300">A equipe será removida da lista de inscritos deste evento.</p>
          <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {deleteTarget?.team_name}
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
                  const result = await removeRegistration(eventId, deleteTarget.team_id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  if (!result.error) setDeleteTarget(null);
                  router.refresh();
                })
              }
            >
              Remover inscrição
            </AdminButton>
          </div>
        </div>
      </AdminModal>
    </section>
  );
}
