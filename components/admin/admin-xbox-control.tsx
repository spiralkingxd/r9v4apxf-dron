"use client";

import { useTransition } from "react";
import { Gamepad2, Pen, Trash2 } from "lucide-react";
import { updateXboxGamertag } from "@/app/admin/member-actions";
import { useAdminToast } from "@/components/admin/admin-toast";

export function AdminXboxControl({
  userId,
  currentGamertag,
  adminRole,
}: {
  userId: string;
  currentGamertag: string | null;
  adminRole?: string | null;
}) {
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  if (adminRole !== "owner") return null;

  function handleUpdate() {
    const newVal = window.prompt("Digite a nova Gamertag Xbox:", currentGamertag || "")?.trim();
    if (newVal === undefined) return;
    if (newVal === currentGamertag) return;
    
    startTransition(async () => {
      const res = await updateXboxGamertag(userId, newVal || null);
      if (res.error) {
        pushToast("error", res.error);
      } else {
        pushToast("success", res.success || "Gamertag atualizada.");
      }
    });
  }

  function handleRemove() {
    if (!window.confirm("Certeza que deseja desvincular a Xbox gamertag deste usuário?")) return;
    startTransition(async () => {
      const res = await updateXboxGamertag(userId, null);
      if (res.error) {
        pushToast("error", res.error);
      } else {
        pushToast("success", res.success || "Gamertag removida.");
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <Gamepad2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="text-sm font-semibold">Conta Xbox</p>
            <p className="text-xs text-slate-400">{currentGamertag || "Nenhuma conta vinculada"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentGamertag ? (
             <button
              onClick={handleRemove}
              disabled={isPending}
              className="flex h-8 items-center gap-1 rounded bg-rose-500/20 px-3 text-xs font-medium text-rose-300 transition hover:bg-rose-500/30 disabled:opacity-50"
             >
               <Trash2 className="h-3 w-3" />
               Remover
             </button>
          ) : null}
          <button
            onClick={handleUpdate}
            disabled={isPending}
            className="flex h-8 items-center gap-1 rounded bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            <Pen className="h-3 w-3" />
            {currentGamertag ? "Alterar" : "Vincular"}
          </button>
        </div>
      </div>
    </div>
  );
}
