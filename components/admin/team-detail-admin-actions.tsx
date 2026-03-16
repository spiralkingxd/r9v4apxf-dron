"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addTeamMember,
  dissolveTeam,
  restoreTeam,
  transferCaptain,
  updateTeam,
} from "@/app/admin/team-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";

type MemberOption = {
  id: string;
  display_name: string;
  username: string;
  isCaptain: boolean;
};

type UserOption = {
  id: string;
  display_name: string;
  username: string;
};

export function TeamDetailAdminActions({
  teamId,
  teamName,
  currentName,
  currentLogoUrl,
  isDissolved,
  members,
  availableUsers,
}: {
  teamId: string;
  teamName: string;
  currentName: string;
  currentLogoUrl: string | null;
  isDissolved: boolean;
  members: MemberOption[];
  availableUsers: UserOption[];
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [addUserId, setAddUserId] = useState(availableUsers[0]?.id ?? "");
  const [transferUserId, setTransferUserId] = useState("");

  const transferCandidates = useMemo(() => members.filter((member) => !member.isCaptain), [members]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminButton
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          const name = window.prompt("Novo nome da equipe:", currentName)?.trim();
          if (!name) return;
          const logo = window.prompt("Nova URL do logo (opcional):", currentLogoUrl ?? "")?.trim() ?? "";
          startTransition(async () => {
            const result = await updateTeam(teamId, { name, logo_url: logo || null });
            pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
            router.refresh();
          });
        }}
      >
        Editar equipe
      </AdminButton>

      {!isDissolved ? (
        <>
          <select
            value={transferUserId}
            onChange={(event) => setTransferUserId(event.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100"
          >
            <option value="">Transferir capitão...</option>
            {transferCandidates.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name} (@{member.username})
              </option>
            ))}
          </select>
          <AdminButton
            type="button"
            variant="ghost"
            disabled={isPending || !transferUserId}
            onClick={() => {
              startTransition(async () => {
                const result = await transferCaptain(teamId, transferUserId);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                if (!result.error) setTransferUserId("");
                router.refresh();
              });
            }}
          >
            Confirmar transferência
          </AdminButton>

          <select
            value={addUserId}
            onChange={(event) => setAddUserId(event.target.value)}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100"
          >
            <option value="">Adicionar membro...</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name} (@{user.username})
              </option>
            ))}
          </select>
          <AdminButton
            type="button"
            variant="ghost"
            disabled={isPending || !addUserId}
            onClick={() => {
              startTransition(async () => {
                const result = await addTeamMember(teamId, addUserId);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              });
            }}
          >
            Adicionar membro
          </AdminButton>

          <AdminButton
            type="button"
            variant="danger"
            disabled={isPending}
            onClick={() => {
              const confirmName = window.prompt(`Digite o nome da equipe para apagar: ${teamName}`)?.trim();
              if (!confirmName) return;
              const reason = window.prompt("Motivo para apagar a equipe:", "Equipe apagada por decisão administrativa")?.trim() ?? "";
              if (!reason) return;

              startTransition(async () => {
                const result = await dissolveTeam(teamId, undefined, reason, { confirmName, notifyDiscord: true });
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                if (result.success) {
                  router.push("/admin/teams");
                }
                router.refresh();
              });
            }}
          >
            Apagar equipe
          </AdminButton>
        </>
      ) : (
        <AdminButton
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await restoreTeam(teamId);
              pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
              router.refresh();
            });
          }}
        >
          Restaurar equipe
        </AdminButton>
      )}
    </div>
  );
}
