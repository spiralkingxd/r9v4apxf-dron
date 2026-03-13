"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, LogOut, ShieldCheck, Trash2, UserCheck } from "lucide-react";

import { banUser, deleteUser, forceLogout, unbanUser, updateUserRole } from "@/app/admin/member-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";

export function MemberDetailActions({
  userId,
  currentRole,
  isBanned,
}: {
  userId: string;
  currentRole: "user" | "admin" | "owner";
  isBanned: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await action();
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {currentRole === "user" ? (
        <AdminButton
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => run(() => updateUserRole(userId, "admin"))}
        >
          <ShieldCheck className="h-4 w-4" />
          Promover para Admin
        </AdminButton>
      ) : null}

      {currentRole === "admin" ? (
        <AdminButton
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => run(() => updateUserRole(userId, "user"))}
        >
          <UserCheck className="h-4 w-4" />
          Rebaixar para User
        </AdminButton>
      ) : null}

      {!isBanned ? (
        <AdminButton
          type="button"
          variant="danger"
          disabled={isPending || currentRole === "owner"}
          onClick={() => {
            const reason = window.prompt("Motivo do banimento:", "Violação de regras")?.trim();
            if (!reason) return;
            const rawDuration = window.prompt("Duração em dias (vazio = permanente):", "")?.trim() ?? "";
            const durationValue = rawDuration ? Number(rawDuration) : null;
            if (rawDuration && (!Number.isFinite(durationValue ?? Number.NaN) || (durationValue ?? 0) <= 0)) {
              pushToast("error", "Duração inválida.");
              return;
            }
            run(() =>
              banUser(userId, reason, durationValue, undefined, {
                notifyDiscord: false,
                removeFromTeams: false,
                cancelActiveRegistrations: false,
              }),
            );
          }}
        >
          <Ban className="h-4 w-4" />
          Banir Usuário
        </AdminButton>
      ) : (
        <AdminButton
          type="button"
          variant="success"
          disabled={isPending}
          onClick={() => run(() => unbanUser(userId))}
        >
          <UserCheck className="h-4 w-4" />
          Desbanir Usuário
        </AdminButton>
      )}

      <AdminButton
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={() => run(() => forceLogout(userId))}
      >
        <LogOut className="h-4 w-4" />
        Forçar Logout Global
      </AdminButton>

      <AdminButton
        type="button"
        variant="danger"
        disabled={isPending || currentRole === "owner"}
        onClick={() => {
          if (!window.confirm("Confirma soft delete da conta?")) return;
          run(() => deleteUser(userId));
        }}
      >
        <Trash2 className="h-4 w-4" />
        Soft Delete da Conta
      </AdminButton>
    </div>
  );
}
