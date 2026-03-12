"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Scroll } from "lucide-react";
import { z } from "zod";

import { registerTeamForEvent, type RegisterTeamState } from "@/app/events/actions";

const schema = z.object({
  team_id: z.string().uuid("Selecione uma equipe válida."),
});

type FormValues = z.infer<typeof schema>;

type TeamOption = { id: string; name: string };

const initial: RegisterTeamState = {};

export function RegisterTeamForm({
  eventId,
  captainTeams,
}: {
  eventId: string;
  captainTeams: TeamOption[];
}) {
  const [state, formAction, isPending] = useActionState(registerTeamForEvent, initial);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { team_id: captainTeams[0]?.id ?? "" },
  });

  function onValid(data: FormValues) {
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("team_id", data.team_id);
    formAction(fd);
  }

  if (state.success) {
    return (
      <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200">
        {state.success}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-4">
      {captainTeams.length > 1 ? (
        <div>
          <label htmlFor="team-select" className="mb-2 block text-sm font-medium text-slate-200">
            Selecione sua equipe
          </label>
          <select
            id="team-select"
            {...register("team_id")}
            disabled={isPending}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:ring focus:ring-amber-300/40 disabled:opacity-50"
          >
            {captainTeams.map((team) => (
              <option key={team.id} value={team.id} className="bg-slate-900">
                {team.name}
              </option>
            ))}
          </select>
          {errors.team_id ? (
            <p className="mt-1.5 text-xs text-rose-400">{errors.team_id.message}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-300">
          Inscrevendo:{" "}
          <span className="font-semibold text-amber-300">{captainTeams[0]?.name}</span>
        </p>
      )}

      {state.error ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
      >
        <Scroll className="h-4 w-4" />
        {isPending ? "Inscrevendo..." : "Inscrever Equipe"}
      </button>
    </form>
  );
}
