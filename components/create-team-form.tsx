"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Anchor } from "lucide-react";
import { z } from "zod";

import { createTeam, type CreateTeamState } from "@/app/teams/actions";

const schema = z.object({
  name: z
    .string()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(50, "O nome pode ter no máximo 50 caracteres."),
});

type FormValues = z.infer<typeof schema>;

const initial: CreateTeamState = { error: null };

export function CreateTeamForm() {
  const [state, formAction, isPending] = useActionState(createTeam, initial);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onValid(data: FormValues) {
    const fd = new FormData();
    fd.set("name", data.name);
    formAction(fd);
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-4">
      <div>
        <label htmlFor="team-name" className="mb-2 block text-sm font-medium text-slate-200">
          Nome da equipe
        </label>
        <input
          id="team-name"
          {...register("name")}
          disabled={isPending}
          placeholder="Ex: Os Imortais do Mar"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-300/40 transition placeholder:text-slate-500 focus:ring disabled:opacity-50"
        />
        {errors.name ? (
          <p className="mt-1.5 text-xs text-rose-400">{errors.name.message}</p>
        ) : null}
      </div>

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
        <Anchor className="h-4 w-4" />
        {isPending ? "Criando tripulação..." : "Fundar Equipe"}
      </button>
    </form>
  );
}
