"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Shuffle } from "lucide-react";

import { generateFirstRoundMatches } from "@/app/admin/match-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminModal } from "@/components/admin/admin-modal";
import { useAdminToast } from "@/components/admin/admin-toast";

export function FirstRoundDrawButton({
  eventId,
  approvedTeamsCount,
  estimatedFirstRoundMatches,
}: {
  eventId: string;
  approvedTeamsCount: number;
  estimatedFirstRoundMatches: number;
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canConfirm = useMemo(
    () => approvedTeamsCount >= 2 && estimatedFirstRoundMatches >= 1,
    [approvedTeamsCount, estimatedFirstRoundMatches],
  );

  function runDraw() {
    startTransition(async () => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      try {
        const actionPromise = generateFirstRoundMatches(eventId);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error("Tempo limite atingido (10s). Tente novamente."));
          }, 10_000);
        });

        const result = await Promise.race([actionPromise, timeoutPromise]);

        if (result.error) {
          pushToast("error", result.error);
          return;
        }

        const createdCount = result.data?.firstRoundMatches ?? estimatedFirstRoundMatches;
        pushToast("success", `${createdCount} partidas da primeira fase criadas com sucesso.`);
        setOpen(false);
        router.replace(`/admin/tournaments/${eventId}/matches`);
        router.refresh();
      } catch (error) {
        pushToast("error", error instanceof Error ? error.message : "Falha ao sortear partidas.");
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    });
  }

  return (
    <>
      <AdminButton type="button" disabled={isPending} onClick={() => setOpen(true)}>
        <Shuffle className="h-4 w-4" />
        {isPending ? "Sorteando partidas..." : "Gerar Chaveamento Automático"}
      </AdminButton>

      <AdminModal open={open} title="Confirmar sorteio automático" onClose={() => !isPending && setOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            O sistema irá embaralhar as equipes aprovadas e criar os confrontos da primeira fase automaticamente.
          </p>

          <div className="grid gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 p-3 text-sm">
            <p className="text-slate-700 dark:text-slate-200">
              Equipes elegíveis: <strong>{approvedTeamsCount}</strong>
            </p>
            <p className="text-slate-700 dark:text-slate-200">
              Partidas estimadas na primeira fase: <strong>{estimatedFirstRoundMatches}</strong>
            </p>
          </div>

          <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Esta ação cria o chaveamento inicial e não deve ser repetida sem reset do bracket.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <AdminButton type="button" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </AdminButton>
            <AdminButton type="button" variant="primary" disabled={isPending || !canConfirm} onClick={runDraw}>
              {isPending ? "Sorteando partidas..." : "Confirmar Sorteio"}
            </AdminButton>
          </div>
        </div>
      </AdminModal>
    </>
  );
}
