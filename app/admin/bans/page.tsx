import { Ban } from "lucide-react";

import { getBans, liftBanEntry, updateBanDuration } from "@/app/admin/member-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { SuspensionCreateForm } from "@/components/admin/suspension-create-form";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

type SearchParams = Promise<{
  active?: string;
  duration?: "all" | "temporary" | "permanent";
  scope?: "all" | "full_access" | "tournament_registration";
}>;

export default async function AdminBansPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const activeOnly = params.active === "1";
  const durationType = params.duration ?? "all";
  const scopeType = params.scope ?? "all";

  const { data, error } = await getBans({
    activeOnly,
    durationType,
    scopeType,
    limit: 300,
  });

  async function handleLift(formData: FormData) {
    "use server";
    const banId = String(formData.get("ban_id") ?? "");
    if (!banId) return;
    await liftBanEntry(banId);
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
      <header className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Admin</p>
        <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Ban className="h-6 w-6 text-rose-400" />
          Banimentos e Suspensoes
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Gerencie banimentos totais e suspensoes temporarias de inscricao em torneios.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Nova Suspensao de Torneios</h2>
        <SuspensionCreateForm />
      </section>

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Status
          <select name="active" defaultValue={activeOnly ? "1" : "0"} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="0">Todos</option>
            <option value="1">Somente ativos</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Duracao
          <select name="duration" defaultValue={durationType} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todas</option>
            <option value="temporary">Temporario</option>
            <option value="permanent">Permanente</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Tipo
          <select name="scope" defaultValue={scopeType} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            <option value="full_access">Banimento total</option>
            <option value="tournament_registration">Suspensao de torneio</option>
          </select>
        </label>

        <AdminButton type="submit" variant="ghost">Aplicar filtros</AdminButton>
      </form>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Usuario</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Tipo</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Admin</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Motivo</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Duracao</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Criado em</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Expira em</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {data.map((ban) => (
                <tr key={ban.id}>
                  <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100">{ban.userName}</td>
                  <td className="px-4 py-3 text-sm">
                    {ban.scope === "tournament_registration" ? (
                      <AdminBadge tone="pending">Suspensao de Torneio</AdminBadge>
                    ) : (
                      <AdminBadge tone="danger">Banimento Total</AdminBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{ban.bannedByName}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{ban.reason}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{ban.duration ? `${ban.duration} dia(s)` : "Permanente"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{dateFmt.format(new Date(ban.createdAt))}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{ban.expiresAt ? dateFmt.format(new Date(ban.expiresAt)) : "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    {ban.isActive ? <AdminBadge tone="danger">Ativo</AdminBadge> : <AdminBadge tone="inactive">Encerrado</AdminBadge>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ban.isActive ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={handleLift}>
                          <input type="hidden" name="ban_id" value={ban.id} />
                          <AdminButton type="submit" variant="success" className="px-3 py-1.5 text-xs">
                            {ban.scope === "tournament_registration" ? "Encerrar suspensao" : "Desbanir"}
                          </AdminButton>
                        </form>
                        <form action={handleDurationUpdate} className="flex items-center gap-1">
                          <input type="hidden" name="ban_id" value={ban.id} />
                          <input
                            name="duration_days"
                            defaultValue={ban.duration ?? ""}
                            placeholder="dias"
                            className="w-16 rounded-lg border border-white/15 bg-slate-100 dark:bg-black/20 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
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
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum registro de banimento/suspensao encontrado.
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
