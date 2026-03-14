"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit3, RotateCcw, ShieldAlert, Users } from "lucide-react";

import { dissolveTeam, restoreTeam, updateTeam } from "@/app/admin/team-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  captain_name: string;
  captain_id: string;
  member_count: number;
  max_members: number;
  created_at: string;
  dissolved_at: string | null;
  tournaments_count: number;
  status: "active" | "incomplete" | "empty" | "dissolved";
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function TeamsTable({ rows }: { rows: TeamRow[] }) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TeamRow["status"]>("all");
  const [sizeFilter, setSizeFilter] = useState<"all" | "solo" | "small" | "full">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30">("all");
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (sizeFilter === "solo" && row.member_count > 1) return false;
      if (sizeFilter === "small" && (row.member_count < 2 || row.member_count > 4)) return false;
      if (sizeFilter === "full" && row.member_count < row.max_members) return false;
      if (dateFilter !== "all") {
        const days = Number(dateFilter);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        if (new Date(row.created_at) < cutoff) return false;
      }
      if (!query) return true;
      return row.name.toLowerCase().includes(query) || row.captain_name.toLowerCase().includes(query);
    });
  }, [rows, search, statusFilter, sizeFilter, dateFilter]);

  const columns: AdminTableColumn<TeamRow>[] = [
    {
      key: "select",
      header: "",
      className: "w-10",
      render: (row) => (
        <input
          type="checkbox"
          checked={Boolean(selected[row.id])}
          onChange={(e) => setSelected((prev) => ({ ...prev, [row.id]: e.target.checked }))}
          className="h-4 w-4 rounded border-white/20 bg-black/20"
          aria-label={`Selecionar ${row.name}`}
        />
      ),
    },
    {
      key: "logo",
      header: "Logo",
      render: (row) => (
        row.logo_url ? (
          <img src={row.logo_url} alt={row.name} className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[10px] font-semibold text-slate-300">
            {row.name.slice(0, 1).toUpperCase()}
          </span>
        )
      ),
    },
    {
      key: "name",
      header: "Nome",
      sortable: true,
      accessor: (row) => row.name,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-100">{row.name}</p>
          <p className="text-xs text-slate-400">Capitão: {row.captain_name}</p>
        </div>
      ),
    },
    {
      key: "captain",
      header: "Capitão",
      sortable: true,
      accessor: (row) => row.captain_name,
      render: (row) => (
        <Link href={`/profile/${row.captain_id}`} className="text-xs text-cyan-200 hover:text-cyan-100">
          {row.captain_name}
        </Link>
      ),
    },
    {
      key: "members",
      header: "Membros",
      sortable: true,
      accessor: (row) => row.member_count,
      render: (row) => (
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {row.member_count}/{row.max_members}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => {
        if (row.status === "dissolved") return <AdminBadge tone="inactive">⚫ Dissolvida</AdminBadge>;
        if (row.status === "empty") return <AdminBadge tone="danger">🔴 Vazia</AdminBadge>;
        if (row.status === "incomplete") return <AdminBadge tone="pending">🟡 Incompleta</AdminBadge>;
        return <AdminBadge tone="active">🟢 Ativa</AdminBadge>;
      },
    },
    {
      key: "tournaments",
      header: "Torneios",
      sortable: true,
      accessor: (row) => row.tournaments_count,
      render: (row) => <span>{row.tournaments_count}</span>,
    },
    {
      key: "created",
      header: "Criação",
      sortable: true,
      accessor: (row) => row.created_at,
      render: (row) => <span className="text-xs">{dateFmt.format(new Date(row.created_at))}</span>,
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Link href={`/admin/teams/${row.id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
            Ver
          </Link>
          <button
            type="button"
            className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-300/20"
            onClick={() => {
              const name = window.prompt("Novo nome da equipe:", row.name)?.trim();
              if (!name) return;
              startTransition(async () => {
                const logo = window.prompt("Logo URL (opcional):", row.logo_url ?? "")?.trim() ?? "";
                const result = await updateTeam(row.id, { name, logo_url: logo || null });
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              });
            }}
          >
            <Edit3 className="mr-1 inline h-3 w-3" />
            Editar
          </button>
          {row.status !== "dissolved" ? (
            <button
              type="button"
              className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-xs text-rose-100 hover:bg-rose-300/20"
              onClick={() => {
                const confirmName = window.prompt(`Digite o nome da equipe para confirmar: ${row.name}`)?.trim();
                if (!confirmName) return;
                const reason = window.prompt("Motivo da dissolução:", "Equipe dissolvida por decisão administrativa")?.trim() ?? "";
                if (!reason) return;
                startTransition(async () => {
                  const result = await dissolveTeam(row.id, undefined, reason, { confirmName, notifyDiscord: true });
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  router.refresh();
                });
              }}
              disabled={isPending}
            >
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Dissolver
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-300/20"
              onClick={() => {
                startTransition(async () => {
                  const result = await restoreTeam(row.id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                  router.refresh();
                });
              }}
              disabled={isPending}
            >
              <RotateCcw className="mr-1 inline h-3 w-3" />
              Restaurar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="admin-surface flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Buscar
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome da equipe ou capitão"
            className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todos</option>
            <option value="active">🟢 Ativas</option>
            <option value="incomplete">🟡 Incompletas</option>
            <option value="empty">🔴 Vazias</option>
            <option value="dissolved">⚫ Dissolvidas</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Tamanho
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value as typeof sizeFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todos</option>
            <option value="solo">Solo (1)</option>
            <option value="small">2-4 membros</option>
            <option value="full">Lotada</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Data
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todas</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Página
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-100">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AdminButton
          type="button"
          variant="ghost"
          onClick={() => {
            const ids = selectedIds.join(",");
            const query = ids ? `?ids=${encodeURIComponent(ids)}` : "";
            window.open(`/admin/teams/export${query}`, "_blank");
          }}
        >
          Exportar CSV
        </AdminButton>
        <AdminButton
          type="button"
          variant="ghost"
          onClick={() => {
            const ids = selectedIds.join(",");
            const query = new URLSearchParams();
            query.set("format", "json");
            if (ids) query.set("ids", ids);
            window.open(`/admin/teams/export?${query.toString()}`, "_blank");
          }}
        >
          Exportar JSON
        </AdminButton>
        <span className="text-xs text-slate-400">Selecionadas: {selectedIds.length}</span>
      </div>

      <AdminTable data={filtered} columns={columns} pageSize={pageSize} emptyText="Nenhuma equipe encontrada." />
    </section>
  );
}
