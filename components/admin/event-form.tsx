"use client";

import { useEffect, useMemo, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createTournament as createEvent, updateTournament as updateEvent, type TournamentMutationInput as EventMutationInput } from "@/app/actions/tournaments";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { useAdminToast } from "@/components/admin/admin-toast";
import { EVENT_KIND_LABELS, toDatetimeLocalValue } from "@/lib/events";

const STATUS_VALUES = ["registrations_open", "check_in", "started", "finished"] as const;
const TOURNAMENT_TYPE_VALUES = ["1v1_elimination", "free_for_all_points", "tdm"] as const;
const CREW_TYPE_VALUES = ["solo_sloop", "sloop", "brig", "galleon"] as const;

const STATUS_LABELS: Record<(typeof STATUS_VALUES)[number], string> = {
  registrations_open: "Inscrições Abertas",
  check_in: "Check-in",
  started: "Iniciado",
  finished: "Finalizado",
};

const TOURNAMENT_TYPE_LABELS: Record<(typeof TOURNAMENT_TYPE_VALUES)[number], string> = {
  "1v1_elimination": "1v1",
  free_for_all_points: "Modo Arena FFA",
  tdm: "Modo TDM",
};

const CREW_TYPE_LABELS: Record<(typeof CREW_TYPE_VALUES)[number], string> = {
  solo_sloop: "Sloop (1 Jogador)",
  sloop: "Sloop (1-2 jogadores)",
  brig: "Brigantine (2-3 jogadores)",
  galleon: "Galleon (3-4 jogadores)",
};

const formSchema = z
  .object({
    title: z.string().trim().min(3, "Nome obrigatório."),
    description: z.string().trim().min(1, "Descrição obrigatória."),
    prize: z.string().trim().min(1, "Premiação obrigatória."),
    tournament_type: z.enum(TOURNAMENT_TYPE_VALUES),
    crew_type: z.enum(CREW_TYPE_VALUES),
    status: z.enum(STATUS_VALUES),
    start_date: z.string().min(1, "Informe a data de início."),
    registration_deadline: z.string().min(1, "Informe o limite de inscrição."),
    end_date: z.string().min(1, "Informe a data de término."),
    logo_url: z.string().optional(),
    banner_url: z.string().optional(),
    scoring_win: z.coerce.number().int().min(0).max(50),
    scoring_loss: z.coerce.number().int().min(0).max(50),
    scoring_draw: z.coerce.number().int().min(0).max(50),
    max_teams: z.union([z.literal(""), z.coerce.number().int().min(2).max(256)]).optional(),
  })
  .superRefine((values, ctx) => {
    const now = new Date();
    const start = new Date(values.start_date);
    const deadline = new Date(values.registration_deadline);
    const end = new Date(values.end_date);

    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["start_date"], message: "Data de início inválida." });
      return;
    }
    if (Number.isNaN(deadline.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registration_deadline"], message: "Limite de inscrição inválido." });
      return;
    }
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "Data de término inválida." });
      return;
    }

    if (start < now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["start_date"], message: "A data de início não pode ser no passado." });
    }

    if (deadline >= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registration_deadline"],
        message: "O limite de inscrição deve ser antes da data de início.",
      });
    }

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "A data de término deve ser após a data de início.",
      });
    }
  });

type FormValues = z.input<typeof formSchema>;
type ParsedFormValues = z.output<typeof formSchema>;

type EventFormValues = EventMutationInput & { id?: string };

function defaults(kind: "event" | "tournament"): EventFormValues {
  return {
    title: "",
    description: "",
    prize: "",
    tournament_type: "1v1_elimination",
    crew_type: "galleon",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    event_kind: kind,
    event_type: "tournament",
    visibility: "public",
    team_size: 4,
    prize_description: "",
    rules: "",
    logo_url: "",
    banner_url: "",
    status: "registrations_open",
    scoring_win: 3,
    scoring_loss: 0,
    scoring_draw: 1,
    tournament_format: "single_elimination",
    rounds_count: 3,
    seeding_method: "random",
    max_teams: 16,
  };
}

function crewTypeToTeamSize(crewType: (typeof CREW_TYPE_VALUES)[number]) {
  if (crewType === "solo_sloop") return 1;
  if (crewType === "sloop") return 2;
  if (crewType === "brig") return 3;
  return 4;
}

function tournamentTypeToFormat(type: (typeof TOURNAMENT_TYPE_VALUES)[number]): EventMutationInput["tournament_format"] {
  if (type === "free_for_all_points" || type === "tdm") return "round_robin";
  return "single_elimination";
}

export function EventForm({
  mode,
  eventId,
  initialValues,
  fixedKind,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
  fixedKind?: "event" | "tournament";
}) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  const initial = useMemo(() => ({ ...defaults(fixedKind ?? initialValues?.event_kind ?? "event"), ...initialValues }), [fixedKind, initialValues]);
  const [description, setDescription] = useState(initial.description ?? "");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues, unknown, ParsedFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initial.title ?? "",
      description: initial.description ?? "",
      prize: initial.prize ?? initial.prize_description ?? "",
      tournament_type: initial.tournament_type ?? "1v1_elimination",
      crew_type: initial.crew_type ?? "galleon",
      status: initial.status ?? "registrations_open",
      start_date: toDatetimeLocalValue(initial.start_date),
      registration_deadline: toDatetimeLocalValue(initial.registration_deadline),
      end_date: toDatetimeLocalValue(initial.end_date),
      logo_url: initial.logo_url ?? "",
      banner_url: initial.banner_url ?? "",
      scoring_win: initial.scoring_win ?? 3,
      scoring_loss: initial.scoring_loss ?? 0,
      scoring_draw: initial.scoring_draw ?? 1,
      max_teams: initial.max_teams ?? 16,
    },
  });

  useEffect(() => {
    setValue("description", description);
  }, [description, setValue]);

  async function onSubmit(values: ParsedFormValues) {
    const payload: EventMutationInput = {
      title: values.title,
      description: values.description,
      prize: values.prize,
      tournament_type: values.tournament_type,
      crew_type: values.crew_type,
      start_date: values.start_date,
      registration_deadline: values.registration_deadline,
      end_date: values.end_date,
      event_kind: fixedKind ?? "tournament",
      event_type: "tournament",
      visibility: "public",
      team_size: crewTypeToTeamSize(values.crew_type),
      prize_description: values.prize,
      rules: null,
      logo_url: values.logo_url || null,
      banner_url: values.banner_url || null,
      status: values.status,
      scoring_win: Number(values.scoring_win),
      scoring_loss: Number(values.scoring_loss),
      scoring_draw: Number(values.scoring_draw),
      tournament_format: tournamentTypeToFormat(values.tournament_type),
      rounds_count: null,
      seeding_method: "random",
      max_teams: values.max_teams === "" ? null : Number(values.max_teams),
    };

    startTransition(async () => {
      const result = mode === "create" ? await createEvent(payload) : await updateEvent(eventId ?? "", payload);

      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
      if (result.error) return;

      const kindPath = "/admin/tournaments";
      if (mode === "create" && result.data?.id) {
        router.push(`${kindPath}/${result.data.id}/edit`);
      } else {
        router.push(kindPath);
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {mode === "create" ? "Novo Evento" : "Editar Evento"}
          </h1>
        </div>
        <AdminBadge tone="info">{EVENT_KIND_LABELS[(fixedKind ?? "tournament") as keyof typeof EVENT_KIND_LABELS]}</AdminBadge>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Nome do Evento</span>
            <input {...register("title")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none" />
            {errors.title ? <span className="text-xs text-rose-300">{errors.title.message}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Tipo de Evento</span>
            <select {...register("tournament_type")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none">
              {TOURNAMENT_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>{TOURNAMENT_TYPE_LABELS[value]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Tipo de Tripulação</span>
            <select {...register("crew_type")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none">
              {CREW_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>{CREW_TYPE_LABELS[value]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Status</span>
            <select {...register("status")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none">
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>{STATUS_LABELS[value]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Premiação</span>
            <input {...register("prize")} placeholder="Ex: R$ 500,00" className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none" />
            {errors.prize ? <span className="text-xs text-rose-300">{errors.prize.message}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Data de Início</span>
            <input type="datetime-local" {...register("start_date")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none" />
            {errors.start_date ? <span className="text-xs text-rose-300">{errors.start_date.message}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Limite de Inscrição</span>
            <input type="datetime-local" {...register("registration_deadline")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none" />
            {errors.registration_deadline ? <span className="text-xs text-rose-300">{errors.registration_deadline.message}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Data de Término</span>
            <input type="datetime-local" {...register("end_date")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none" />
            {errors.end_date ? <span className="text-xs text-rose-300">{errors.end_date.message}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Logo</span>
            <input {...register("logo_url")} placeholder="https://..." className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Banner</span>
            <input {...register("banner_url")} placeholder="https://..." className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>
        </div>

        <MarkdownEditor
          label="Descrição"
          value={description}
          onChange={setDescription}
          placeholder="Descreva o evento em Markdown..."
          previewLabel="Preview em tempo real"
          helperText="Use Markdown para formatar a descrição."
          minHeight={440}
        />
        {errors.description ? <span className="block text-xs text-rose-300">{errors.description.message}</span> : null}

        <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pontuação</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Usada no recálculo automático do ranking ao finalizar o evento.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Vitória</span>
              <input type="number" {...register("scoring_win")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Derrota</span>
              <input type="number" {...register("scoring_loss")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Empate</span>
              <input type="number" {...register("scoring_draw")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Máximo de equipes</span>
              <input type="number" {...register("max_teams")} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 px-4 py-3 text-sm outline-none" />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          <AdminButton type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
            Cancelar
          </AdminButton>
          <AdminButton type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : mode === "create" ? "Criar" : "Salvar alterações"}
          </AdminButton>
        </div>
      </form>
    </section>
  );
}
