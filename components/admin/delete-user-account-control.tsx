"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, UserX } from "lucide-react";

import { deleteUserAccount } from "@/app/admin/member-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminModal } from "@/components/admin/admin-modal";
import { useAdminToast } from "@/components/admin/admin-toast";

type TargetUser = {
  id: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  discordId?: string | null;
  role?: "user" | "admin" | "owner";
};

type Props = {
  target: TargetUser;
  currentAdminId: string;
  currentAdminRole: "admin" | "owner";
  reasonPlaceholder?: string;
  buttonLabel?: string;
  compact?: boolean;
  onDeleted?: (userId: string) => void;
  redirectTo?: string;
};

export function DeleteUserAccountControl({
  target,
  currentAdminId,
  currentAdminRole,
  reasonPlaceholder = "Motivo opcional para auditoria.",
  buttonLabel = "Deletar conta",
  compact = false,
  onDeleted,
  redirectTo,
}: Props) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const deleteDisabledReason = useMemo(() => {
    if (target.role === "owner") return "Conta owner nao pode ser deletada.";
    if (target.role === "admin" && currentAdminRole !== "owner") return "Apenas owner pode deletar outro admin.";
    return null;
  }, [currentAdminRole, target.role]);

  const displayName = target.displayName?.trim() || target.username?.trim() || "Usuario";
  const username = target.username?.trim() || "-";
  const expectedLabel = username !== "-" ? `DELETAR ou ${username}` : "DELETAR";

  function resetForm() {
    setConfirmation("");
    setReason("");
  }

  function handleOpen() {
    if (deleteDisabledReason) {
      pushToast("error", deleteDisabledReason);
      return;
    }
    setOpen(true);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUserAccount(target.id, currentAdminId, confirmation, reason || undefined);

      if (!result.success) {
        pushToast("error", `Erro ao deletar conta: ${result.error ?? "falha desconhecida"}`);
        return;
      }

      pushToast("success", result.message ?? `Conta de ${displayName} foi deletada permanentemente.`);
      setOpen(false);
      resetForm();
      onDeleted?.(target.id);

      if (redirectTo) {
        router.push(redirectTo);
      }

      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        title="Deletar conta permanentemente"
        onClick={handleOpen}
        disabled={Boolean(deleteDisabledReason) || isPending}
        className={
          compact
            ? "rounded-lg border border-rose-300 dark:border-rose-300/30 bg-rose-200 dark:bg-rose-300/10 px-2 py-1 text-xs text-rose-800 dark:text-rose-100 hover:bg-rose-300 dark:hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-40"
            : "inline-flex items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-300/30 bg-rose-200 dark:bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-800 dark:text-rose-100 hover:bg-rose-300 dark:hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        {compact ? <Trash2 className="inline h-3 w-3" /> : <UserX className="h-4 w-4" />}
        {compact ? "Deletar" : buttonLabel}
      </button>

      <AdminModal open={open} title="Deletar Conta de Usuario" onClose={() => (!isPending ? setOpen(false) : null)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 p-3">
            {target.avatarUrl ? (
              <img src={target.avatarUrl} alt={displayName} className="h-12 w-12 rounded-full border border-slate-300 dark:border-white/20 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 dark:border-white/20 bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-300">
                <UserX className="h-5 w-5" />
              </div>
            )}
            <div className="text-sm">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{displayName}</p>
              <p className="text-slate-500 dark:text-slate-400">@{username}</p>
              <p className="text-xs text-slate-500">Discord ID: {target.discordId ?? "-"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-rose-300 dark:border-rose-300/35 bg-rose-50 dark:bg-rose-300/10 p-4 text-rose-800 dark:text-rose-100">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Esta acao e IRREVERSIVEL
            </p>
            <p className="mt-2 text-sm">Todos os dados serao permanentemente excluidos.</p>
            <p className="text-sm">Equipes vinculadas podem ser transferidas ou dissolvidas.</p>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Confirmacao</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={`Digite ${expectedLabel}`}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Motivo (opcional)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder={reasonPlaceholder}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none"
            />
          </label>

          <div className="flex justify-end gap-3">
            <AdminButton type="button" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </AdminButton>
            <AdminButton
              type="button"
              variant="danger"
              disabled={isPending || confirmation.trim().length === 0}
              onClick={handleDelete}
            >
              {isPending ? "Deletando..." : "Deletar Permanentemente"}
            </AdminButton>
          </div>
        </div>
      </AdminModal>
    </>
  );
}
