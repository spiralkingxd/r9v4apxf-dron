"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit3, RotateCcw, ShieldAlert, Users } from "lucide-react";

import { dissolveTeam, restoreTeam, updateTeam } from "@/app/admin/team-actions";
import { AdminAutocompleteInput } from "@/components/admin/admin-autocomplete-input";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminModal } from "@/components/admin/admin-modal";
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

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

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

  const [dissolveTarget, setDissolveTarget] = useState<TeamRow | null>(null);
  const [dissolveConfirmName, setDissolveConfirmName] = useState("");
  const [dissolveReason, setDissolveReason] = useState("Equipe dissolvida por decisao administrativa");
  const [dissolveNotifyDiscord, setDissolveNotifyDiscord] = useState(true);

  const [editTarget, setEditTarget] = useState<TeamRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editMaxMembers, setEditMaxMembers] = useState("10");

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const teamSearchOptions = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: `Capitao: ${row.captain_name}`,
      })),
    [rows],
  );

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
          className="h-4 w-4 rounded border-white/20 bg-slate-100 dark:bg-black/20"
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
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-white/5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
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
          <p className="font-medium text-slate-800 dark:text-slate-100">{row.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Capitao: {row.captain_name}</p>
        </div>
      ),
    },
    {
      key: "captain",
      header: "Capitao",
      sortable: true,
      accessor: (row) => row.captain_name,
      render: (row) => (
        <Link href={`/profile/${row.captain_id}`} className="text-xs text-cyan-200 hover:text-cyan-900 dark:text-cyan-100">
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
        if (row.status === "dissolved") return <AdminBadge tone="inactive">Dissolvida</AdminBadge>;
        if (row.status === "empty") return <AdminBadge tone="danger">Vazia</AdminBadge>;
        if (row.status === "incomplete") return <AdminBadge tone="pending">Incompleta</AdminBadge>;
        return <AdminBadge tone="active">Ativa</AdminBadge>;
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
      header: "Criacao",
      sortable: true,
      accessor: (row) => row.created_at,
      render: (row) => <span className="text-xs">{dateFmt.format(new Date(row.created_at))}</span>,
    },
    {
      key: "actions",
      header: "Acoes",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Link href={`/admin/teams/${row.id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
            Ver
          </Link>
          <button
            type="button"
            className="rounded-lg border border-cyan-300/30 bg-cyan-100 dark:bg-cyan-300/10 px-2 py-1 text-xs text-cyan-900 dark:text-cyan-100 hover:bg-cyan-300/20"
            onClick={() => {
              setEditTarget(row);
              setEditName(row.name);
              setEditLogoUrl(row.logo_url ?? "");
              setEditMaxMembers(String(row.max_members));
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
                setDissolveTarget(row);
                setDissolveConfirmName("");
                setDissolveReason("Equipe dissolvida por decisao administrativa");
                setDissolveNotifyDiscord(true);
              }}
              disabled={isPending}
            >
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Apagar
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-300/20"
              onClick={() => {
                startTransition(async () => {
                  const result = await restoreTeam(row.id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
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
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Buscar
          <AdminAutocompleteInput
            placeholder="Nome da equipe ou capitao"
            localOptions={teamSearchOptions}
            onQueryChange={setSearch}
            onSelect={(option) => setSearch(option.title)}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            <option value="active">Ativas</option>
            <option value="incomplete">Incompletas</option>
            <option value="empty">Vazias</option>
            <option value="dissolved">Dissolvidas</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Tamanho
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value as typeof sizeFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            <option value="solo">Solo (1)</option>
            <option value="small">2-4 membros</option>
            <option value="full">Lotada</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Data
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todas</option>
            <option value="7">Ultimos 7 dias</option>
            <option value="30">Ultimos 30 dias</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Pagina
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
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
        <span className="text-xs text-slate-500 dark:text-slate-400">Selecionadas: {selectedIds.length}</span>
      </div>

      <AdminTable data={filtered} columns={columns} pageSize={pageSize} emptyText="Nenhuma equipe encontrada." />

      <AdminModal open={Boolean(dissolveTarget)} title="Apagar equipe" onClose={() => !isPending && setDissolveTarget(null)}>
        {dissolveTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Esta acao vai apagar a equipe <span className="font-semibold text-slate-900 dark:text-white">{dissolveTarget.name}</span>, remover membros e cancelar inscricoes pendentes.
            </p>
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Confirmacao
              <input
                value={dissolveConfirmName}
                onChange={(event) => setDissolveConfirmName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                placeholder={dissolveTarget.name}
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Motivo
              <textarea
                value={dissolveReason}
                onChange={(event) => setDissolveReason(event.target.value)}
                className="mt-1 h-24 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={dissolveNotifyDiscord} onChange={(event) => setDissolveNotifyDiscord(event.target.checked)} />
              Notificar no Discord
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <AdminButton type="button" variant="ghost" disabled={isPending} onClick={() => setDissolveTarget(null)}>Cancelar</AdminButton>
              <AdminButton
                type="button"
                variant="danger"
                disabled={isPending || dissolveConfirmName.trim() !== dissolveTarget.name.trim() || dissolveReason.trim().length < 2}
                onClick={() =>
                  startTransition(async () => {
                    const result = await dissolveTeam(dissolveTarget.id, undefined, dissolveReason.trim(), {
                      confirmName: dissolveConfirmName.trim(),
                      notifyDiscord: dissolveNotifyDiscord,
                    });
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                    if (!result.error) setDissolveTarget(null);
                    router.refresh();
                  })
                }
              >
                Confirmar apagar equipe
              </AdminButton>
            </div>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal open={Boolean(editTarget)} title="Editar equipe" onClose={() => !isPending && setEditTarget(null)}>
        {editTarget ? (
          <div className="space-y-4">
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Nome
              <input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
            </label>
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Logo URL
              <input value={editLogoUrl} onChange={(event) => setEditLogoUrl(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
            </label>
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Maximo de membros
              <input type="number" min={1} max={10} value={editMaxMembers} onChange={(event) => setEditMaxMembers(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
            </label>
            <div className="flex justify-end gap-2">
              <AdminButton type="button" variant="ghost" onClick={() => setEditTarget(null)} disabled={isPending}>Cancelar</AdminButton>
              <AdminButton
                type="button"
                disabled={isPending || editName.trim().length < 3}
                onClick={() =>
                  startTransition(async () => {
                    const parsedMax = Number(editMaxMembers);
                    const result = await updateTeam(editTarget.id, {
                      name: editName.trim(),
                      logo_url: editLogoUrl.trim() || null,
                      max_members: Number.isFinite(parsedMax) ? parsedMax : undefined,
                    });
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                    if (!result.error) setEditTarget(null);
                    router.refresh();
                  })
                }
              >
                Salvar
              </AdminButton>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </section>
  );
}
