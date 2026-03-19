"use client";

import { useState, useTransition } from "react";

import { banUser } from "@/app/admin/member-actions";
import { searchAdminUsers } from "@/app/admin/search-actions";
import { AdminAutocompleteInput } from "@/components/admin/admin-autocomplete-input";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";

export function SuspensionCreateForm() {
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [selectedLabel, setSelectedLabel] = useState("");

  function onSelect(option: { id: string; title: string; subtitle?: string }) {
    setUserId(option.id);
    setSelectedLabel(option.title);
  }

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <AdminAutocompleteInput
          label="Usuario"
          placeholder="Digite gamertag, discord ou nome..."
          fetchOptions={searchAdminUsers}
          onSelect={onSelect}
        />
        {userId ? <p className="mt-1 text-[11px] text-slate-500">Selecionado: {selectedLabel}</p> : null}
      </div>

      <label className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        Motivo
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motivo da suspensao"
          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
        />
      </label>

      <div className="flex items-end gap-2">
        <label className="w-full text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Duracao (dias)
          <input
            value={durationDays}
            onChange={(event) => setDurationDays(event.target.value)}
            placeholder="7"
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
          />
        </label>
        <AdminButton
          type="button"
          variant="ghost"
          disabled={isPending || !userId || reason.trim().length < 2}
          onClick={() =>
            startTransition(async () => {
              const parsedDuration = durationDays.trim() ? Number(durationDays) : null;
              if (durationDays.trim() && (!Number.isFinite(parsedDuration ?? Number.NaN) || (parsedDuration ?? 0) <= 0)) {
                pushToast("error", "Duracao invalida.");
                return;
              }
              const result = await banUser(userId, reason.trim(), parsedDuration, undefined, { scope: "tournament_registration" });
              pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
              if (!result.error) {
                setReason("");
              }
            })
          }
        >
          Suspender
        </AdminButton>
      </div>
    </div>
  );
}
