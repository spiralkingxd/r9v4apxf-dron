"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Pause, Play, Rocket, Trash2, Trophy } from "lucide-react";

import {
  activateEvent,
  deleteEvent,
  duplicateEvent,
  finalizeEvent,
  pauseEvent,
  publishEvent,
} from "@/app/admin/event-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";

type Props = {
  eventId: string;
  status: "draft" | "published" | "active" | "paused" | "finished";
};

export function EventDetailAdminActions({ eventId, status }: Props) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  function runAction(task: () => Promise<{ error?: string; success?: string; data?: { id: string } }>, onSuccess?: (id?: string) => void) {
    startTransition(async () => {
      const result = await task();
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
      if (!result.error) onSuccess?.(result.data?.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        <AdminButton type="button" onClick={() => runAction(() => publishEvent(eventId))} disabled={isPending}>
          <Rocket className="mr-2 h-4 w-4" />
          Publicar
        </AdminButton>
      ) : null}

      {(status === "published" || status === "paused") ? (
        <AdminButton type="button" onClick={() => runAction(() => activateEvent(eventId))} disabled={isPending}>
          <Play className="mr-2 h-4 w-4" />
          Ativar
        </AdminButton>
      ) : null}

      {(status === "published" || status === "active") ? (
        <AdminButton type="button" onClick={() => runAction(() => pauseEvent(eventId))} disabled={isPending}>
          <Pause className="mr-2 h-4 w-4" />
          Pausar
        </AdminButton>
      ) : null}

      {status !== "finished" ? (
        <AdminButton type="button" onClick={() => runAction(() => finalizeEvent(eventId))} disabled={isPending}>
          <Trophy className="mr-2 h-4 w-4" />
          Finalizar
        </AdminButton>
      ) : null}

      <AdminButton
        type="button"
        variant="ghost"
        onClick={() =>
          runAction(() => duplicateEvent(eventId), (id) => {
            if (id) router.push(`/admin/tournaments/${id}/edit`);
          })
        }
        disabled={isPending}
      >
        <CopyPlus className="mr-2 h-4 w-4" />
        Duplicar
      </AdminButton>

      <AdminButton
        type="button"
        variant="danger"
        onClick={() => {
          if (!window.confirm("Deseja excluir este evento permanentemente?")) return;
          runAction(
            () => deleteEvent(eventId),
            () => {
              router.push("/admin/tournaments");
            },
          );
        }}
        disabled={isPending}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Excluir
      </AdminButton>
    </div>
  );
}
