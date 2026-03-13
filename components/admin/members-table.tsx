"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Shield, ShieldCheck, UserCheck, UserCog } from "lucide-react";

import { banUser, bulkManageMembers, unbanUser, updateUserRole } from "@/app/admin/member-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";

type MemberRow = {
  id: string;
  avatar_url: string | null;
  display_name: string;
  username: string;
  discord_id: string | null;
  xbox_gamertag: string | null;
  email: string | null;
  role: "user" | "admin" | "owner";
  is_banned: boolean;
  created_at: string;
  team_count: number;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | MemberRow["role"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7" | "30">("all");
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;

      if (statusFilter === "active" && row.is_banned) return false;
      if (statusFilter === "banned" && !row.is_banned) return false;

      if (dateFilter !== "all") {
        const days = Number(dateFilter);
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        if (new Date(row.created_at).getTime() < cutoff) return false;
      }

      if (!query) return true;

      const haystack = [
        row.display_name,
        row.username,
        row.discord_id ?? "",
        row.email ?? "",
        row.xbox_gamertag ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, roleFilter, statusFilter, dateFilter, search]);

  const columns = useMemo<AdminTableColumn<MemberRow>[]>(() => {
    return [
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
            aria-label={`Selecionar ${row.display_name}`}
          />
        ),
      },
      {
        key: "member",
        header: "Membro",
        sortable: true,
        accessor: (row) => row.display_name,
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{row.display_name}</span>
            <span className="text-xs text-slate-400">@{row.username}</span>
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        sortable: true,
        accessor: (row) => row.email ?? "",
        render: (row) => <span className="text-xs text-slate-300">{row.email ?? "-"}</span>,
      },
      {
        key: "role",
        header: "Role",
        sortable: true,
        accessor: (row) => row.role,
        render: (row) => {
          if (row.role === "owner") return <AdminBadge tone="active">Owner</AdminBadge>;
          if (row.role === "admin") return <AdminBadge tone="info">Admin</AdminBadge>;
          return <AdminBadge tone="inactive">User</AdminBadge>;
        },
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        accessor: (row) => {
          if (row.is_banned) return "banned";
          const pendingCutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
          if (new Date(row.created_at).getTime() >= pendingCutoff && row.team_count === 0) return "pending";
          return "active";
        },
        render: (row) => {
          if (row.is_banned) return <AdminBadge tone="danger">Banido</AdminBadge>;
          const pendingCutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
          if (new Date(row.created_at).getTime() >= pendingCutoff && row.team_count === 0) {
            return <AdminBadge tone="pending">Pendente</AdminBadge>;
          }
          return <AdminBadge tone="active">Ativo</AdminBadge>;
        },
      },
      {
        key: "teams",
        header: "Equipes",
        sortable: true,
        accessor: (row) => row.team_count,
        render: (row) => <span>{row.team_count}</span>,
      },
      {
        key: "created",
        header: "Cadastro",
        sortable: true,
        accessor: (row) => row.created_at,
        render: (row) => <span className="text-xs">{dateFmt.format(new Date(row.created_at))}</span>,
      },
      {
        key: "actions",
        header: "Acoes",
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            <Link href={`/admin/members/${row.id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
              Ver
            </Link>
            {row.role === "user" ? (
              <button
                type="button"
                className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-300/20"
                onClick={() =>
                  startTransition(async () => {
                    const result = await updateUserRole(row.id, "admin");
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                    router.refresh();
                  })
                }
              >
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                Promover
              </button>
            ) : null}
            {row.role === "admin" ? (
              <button
                type="button"
                className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100 hover:bg-amber-300/20"
                onClick={() =>
                  startTransition(async () => {
                    const result = await updateUserRole(row.id, "user");
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                    router.refresh();
                  })
                }
              >
                <Shield className="mr-1 inline h-3 w-3" />
                Rebaixar
              </button>
            ) : null}
            {!row.is_banned && row.role !== "owner" ? (
              <button
                type="button"
                className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-xs text-rose-100 hover:bg-rose-300/20"
                onClick={() => {
                  const reason = window.prompt("Motivo do banimento:", "Violacao de regras")?.trim();
                  if (!reason) return;
                  startTransition(async () => {
                    const result = await banUser(row.id, reason, null);
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                    router.refresh();
                  });
                }}
              >
                <Ban className="mr-1 inline h-3 w-3" />
                Banir
              </button>
            ) : null}
            {row.is_banned ? (
              <button
                type="button"
                className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-300/20"
                onClick={() =>
                  startTransition(async () => {
                    const result = await unbanUser(row.id);
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                    router.refresh();
                  })
                }
              >
                <UserCheck className="mr-1 inline h-3 w-3" />
                Desbanir
              </button>
            ) : null}
          </div>
        ),
      },
    ];
  }, [pushToast, router, selected, startTransition]);

  async function runBulkAction(action: "promote" | "demote" | "ban") {
    if (selectedIds.length === 0) {
      pushToast("info", "Selecione pelo menos um membro.");
      return;
    }

    let reason = "";
    if (action === "ban") {
      reason = window.prompt("Motivo do banimento em lote:", "Violacao de regras")?.trim() ?? "";
      if (!reason) return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("bulk_action", action);
      if (reason) fd.set("bulk_reason", reason);
      for (const id of selectedIds) fd.append("member_ids", id);

      const result = await bulkManageMembers(fd);
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
      if (!result.error) setSelected({});
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Buscar
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, username, Discord ID, email ou Xbox"
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Role
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todas</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="banned">Banido</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Data
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todas</option>
            <option value="7">Ultimos 7 dias</option>
            <option value="30">Ultimos 30 dias</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Pagina
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AdminButton type="button" variant="ghost" disabled={isPending} onClick={() => runBulkAction("promote")}>
          <UserCog className="h-4 w-4" />
          Promover em lote
        </AdminButton>
        <AdminButton type="button" variant="ghost" disabled={isPending} onClick={() => runBulkAction("demote")}>
          <Shield className="h-4 w-4" />
          Rebaixar em lote
        </AdminButton>
        <AdminButton type="button" variant="danger" disabled={isPending} onClick={() => runBulkAction("ban")}>
          <Ban className="h-4 w-4" />
          Banir em lote
        </AdminButton>
        <AdminButton
          type="button"
          variant="ghost"
          onClick={() => {
            const ids = selectedIds.join(",");
            const query = ids ? `?ids=${encodeURIComponent(ids)}` : "";
            window.open(`/admin/members/export${query}`, "_blank");
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
            window.open(`/admin/members/export?${query.toString()}`, "_blank");
          }}
        >
          Exportar JSON
        </AdminButton>
        <span className="text-xs text-slate-400">Selecionados: {selectedIds.length}</span>
      </div>

      <AdminTable data={filtered} columns={columns} pageSize={pageSize} emptyText="Nenhum membro encontrado." />
    </section>
  );
}
