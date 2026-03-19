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
  const [editName, setEditName] = useState(currentName);
  const [editLogoUrl, setEditLogoUrl] = useState(currentLogoUrl ?? "");

  const transferCandidates = useMemo(() => members.filter((member) => !member.isCaptain), [members]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          placeholder="Nome da equipe"
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
        />
        <input
          value={editLogoUrl}
          onChange={(event) => setEditLogoUrl(event.target.value)}
          placeholder="Logo URL"
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
        />
        <AdminButton
          type="button"
          variant="ghost"
          disabled={isPending || editName.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              const result = await updateTeam(teamId, { name: editName.trim(), logo_url: editLogoUrl.trim() || null });
              pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
              router.refresh();
            })
          }
        >
          Salvar edicao
        </AdminButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isDissolved ? (
          <>
            <select
              value={transferUserId}
              onChange={(event) => setTransferUserId(event.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="">Transferir capitao...</option>
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
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                  if (!result.error) setTransferUserId("");
                  router.refresh();
                });
              }}
            >
              Confirmar transferencia
            </AdminButton>

            <select
              value={addUserId}
              onChange={(event) => setAddUserId(event.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
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
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
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
                const reason = window.prompt("Motivo para apagar a equipe:", "Equipe apagada por decisao administrativa")?.trim() ?? "";
                if (!reason) return;

                startTransition(async () => {
                  const result = await dissolveTeam(teamId, undefined, reason, { confirmName, notifyDiscord: true });
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                  if (result.success) router.push("/admin/teams");
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
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
                router.refresh();
              });
            }}
          >
            Restaurar equipe
          </AdminButton>
        )}
      </div>
    </div>
  );
}
