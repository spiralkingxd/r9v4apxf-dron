import { Ban } from "lucide-react";

import { getBans, unbanUser, updateBanDuration } from "@/app/admin/member-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

type SearchParams = Promise<{
  active?: string;
  duration?: "all" | "temporary" | "permanent";
}>;

export default async function AdminBansPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const activeOnly = params.active === "1";
  const durationType = params.duration ?? "all";

  const { data, error } = await getBans({
    activeOnly,
    durationType,
    limit: 300,
  });

  async function handleUnban(formData: FormData) {
    "use server";
    const userId = String(formData.get("user_id") ?? "");
    if (!userId) return;
    await unbanUser(userId);
  }

  async function handleDurationUpdate(formData: FormData) {
    "use server";
    const banId = String(formData.get("ban_id") ?? "");
    const durationRaw = String(formData.get("duration_days") ?? "").trim();
    if (!banId) return;
    const duration = durationRaw ? Number(durationRaw) : null;
    await updateBanDuration(banId, Number.isFinite(duration ?? Number.NaN) ? duration : null);
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-white">
          <Ban className="h-6 w-6 text-rose-300" />
          Sistema de Banimentos
        </h1>
        <p className="mt-2 text-sm text-slate-400">Lista de banimentos ativos e histórico completo.</p>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Status
          <select name="active" defaultValue={activeOnly ? "1" : "0"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value="0">Todos</option>
            <option value="1">Somente ativos</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-400">
          Duração
          <select name="duration" defaultValue={durationType} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
            <option value="all">Todas</option>
            <option value="temporary">Temporário</option>
            <option value="permanent">Permanente</option>
          </select>
        </label>

        <AdminButton type="submit" variant="ghost">Aplicar filtros</AdminButton>
      </form>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Usuário</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Admin</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Motivo</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Duração</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Criado em</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Expira em</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {data.map((ban) => (
                <tr key={ban.id}>
                  <td className="px-4 py-3 text-sm text-slate-100">{ban.userName}</td>
                  <td className="px-4 py-3 text-sm text-slate-200">{ban.bannedByName}</td>
                  <td className="px-4 py-3 text-sm text-slate-200">{ban.reason}</td>
                  <td className="px-4 py-3 text-sm text-slate-200">{ban.duration ? `${ban.duration} dia(s)` : "Permanente"}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{dateFmt.format(new Date(ban.createdAt))}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{ban.expiresAt ? dateFmt.format(new Date(ban.expiresAt)) : "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    {ban.isActive ? <AdminBadge tone="danger">Ativo</AdminBadge> : <AdminBadge tone="inactive">Encerrado</AdminBadge>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ban.isActive ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={handleUnban}>
                          <input type="hidden" name="user_id" value={ban.userId} />
                          <AdminButton type="submit" variant="success" className="px-3 py-1.5 text-xs">Desbanir</AdminButton>
                        </form>
                        <form action={handleDurationUpdate} className="flex items-center gap-1">
                          <input type="hidden" name="ban_id" value={ban.id} />
                          <input
                            name="duration_days"
                            defaultValue={ban.duration ?? ""}
                            placeholder="dias"
                            className="w-16 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-xs text-slate-100"
                          />
                          <AdminButton type="submit" variant="ghost" className="px-2 py-1 text-xs">Atualizar</AdminButton>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    Nenhum banimento encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
