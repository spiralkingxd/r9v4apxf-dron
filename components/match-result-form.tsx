"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { updateMatchResult, type UpdateMatchState } from "@/app/events/actions";

const schema = z.object({
  score_a: z.number().int().min(0, "Placar A inválido."),
  score_b: z.number().int().min(0, "Placar B inválido."),
});

type FormValues = z.infer<typeof schema>;

const initial: UpdateMatchState = {};

export function MatchResultForm({
  eventId,
  matchId,
  teamAId,
  teamBId,
  scoreA,
  scoreB,
}: {
  eventId: string;
  matchId: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
}) {
  const [state, formAction, isPending] = useActionState(updateMatchResult, initial);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      score_a: scoreA,
      score_b: scoreB,
    },
  });

  function onValid(data: FormValues) {
    const formData = new FormData();
    formData.set("event_id", eventId);
    formData.set("match_id", matchId);
    formData.set("team_a_id", teamAId);
    formData.set("team_b_id", teamBId);
    formData.set("score_a", String(data.score_a));
    formData.set("score_b", String(data.score_b));
    formAction(formData);
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="mt-3 space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/6 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-300/80">Editar resultado</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${matchId}-score-a`} className="mb-1 block text-xs text-slate-300">
            Placar A
          </label>
          <input
            id={`${matchId}-score-a`}
            type="number"
            min={0}
            disabled={isPending}
            {...register("score_a", { valueAsNumber: true })}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring disabled:opacity-60"
          />
          {errors.score_a ? <p className="mt-1 text-[11px] text-rose-400">{errors.score_a.message}</p> : null}
        </div>

        <div>
          <label htmlFor={`${matchId}-score-b`} className="mb-1 block text-xs text-slate-300">
            Placar B
          </label>
          <input
            id={`${matchId}-score-b`}
            type="number"
            min={0}
            disabled={isPending}
            {...register("score_b", { valueAsNumber: true })}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring disabled:opacity-60"
          />
          {errors.score_b ? <p className="mt-1 text-[11px] text-rose-400">{errors.score_b.message}</p> : null}
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-2 py-1.5 text-xs text-rose-300">{state.error}</p>
      ) : null}

      {state.success ? (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1.5 text-xs text-emerald-300">{state.success}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
      >
        {isPending ? "Salvando..." : "Salvar resultado"}
      </button>
    </form>
  );
}
