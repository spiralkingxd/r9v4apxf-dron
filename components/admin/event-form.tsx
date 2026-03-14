"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createEvent, type EventMutationInput, updateEvent } from "@/app/admin/event-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { useAdminToast } from "@/components/admin/admin-toast";
import {
  EVENT_KIND_LABELS,
  EVENT_KIND_VALUES,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_VALUES,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_VALUES,
  EVENT_VISIBILITY_LABELS,
  EVENT_VISIBILITY_VALUES,
  SEEDING_METHOD_LABELS,
  SEEDING_METHOD_VALUES,
  TEAM_SIZE_VALUES,
  TOURNAMENT_FORMAT_LABELS,
  TOURNAMENT_FORMAT_VALUES,
  toDatetimeLocalValue,
} from "@/lib/events";

const formSchema = z.object({
  title: z.string().trim().min(3, "Nome muito curto.").max(120, "Nome muito longo."),
  description: z.string().optional(),
  start_date: z.string().min(1, "Informe a data de início."),
  end_date: z.string().optional(),
  registration_deadline: z.string().optional(),
  event_kind: z.enum(EVENT_KIND_VALUES),
  event_type: z.enum(EVENT_TYPE_VALUES),
  visibility: z.enum(EVENT_VISIBILITY_VALUES),
  team_size: z.coerce.number().int().min(1).max(10),
  prize_description: z.string().optional(),
  rules: z.string().optional(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  status: z.enum(EVENT_STATUS_VALUES),
  scoring_win: z.coerce.number().int().min(0).max(50),
  scoring_loss: z.coerce.number().int().min(0).max(50),
  scoring_draw: z.coerce.number().int().min(0).max(50),
  tournament_format: z.string().optional(),
  rounds_count: z.union([z.literal(""), z.coerce.number().int().min(1).max(32)]).optional(),
  seeding_method: z.string().optional(),
  max_teams: z.union([z.literal(""), z.coerce.number().int().min(2).max(256)]).optional(),
});

type FormValues = z.input<typeof formSchema>;
type ParsedFormValues = z.output<typeof formSchema>;

type EventFormValues = EventMutationInput & { id?: string };

function defaults(kind: "event" | "tournament"): EventFormValues {
  return {
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    event_kind: kind,
    event_type: kind === "tournament" ? "tournament" : "special",
    visibility: "public",
    team_size: 4,
    prize_description: "",
    rules: "",
    logo_url: "",
    banner_url: "",
    status: "published",
    scoring_win: 3,
    scoring_loss: 0,
    scoring_draw: 1,
    tournament_format: kind === "tournament" ? "single_elimination" : null,
    rounds_count: kind === "tournament" ? 3 : null,
    seeding_method: "random",
    max_teams: 16,
  };
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
  const [rules, setRules] = useState(initial.rules ?? "");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues, unknown, ParsedFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initial.title ?? "",
      description: initial.description ?? "",
      start_date: toDatetimeLocalValue(initial.start_date),
      end_date: toDatetimeLocalValue(initial.end_date),
      registration_deadline: toDatetimeLocalValue(initial.registration_deadline),
      event_kind: fixedKind ?? initial.event_kind ?? "event",
      event_type: initial.event_type ?? (fixedKind === "tournament" ? "tournament" : "special"),
      visibility: initial.visibility ?? "public",
      team_size: initial.team_size ?? 4,
      prize_description: initial.prize_description ?? "",
      rules: initial.rules ?? "",
      logo_url: initial.logo_url ?? "",
      banner_url: initial.banner_url ?? "",
      status: initial.status ?? "draft",
      scoring_win: initial.scoring_win ?? 3,
      scoring_loss: initial.scoring_loss ?? 0,
      scoring_draw: initial.scoring_draw ?? 1,
      tournament_format: initial.tournament_format ?? (fixedKind === "tournament" ? "single_elimination" : ""),
      rounds_count: initial.rounds_count ?? (fixedKind === "tournament" ? 3 : ""),
      seeding_method: initial.seeding_method ?? "random",
      max_teams: initial.max_teams ?? 16,
    },
  });

  const eventKind = watch("event_kind");

  useEffect(() => {
    setValue("description", description);
  }, [description, setValue]);

  useEffect(() => {
    setValue("rules", rules);
  }, [rules, setValue]);

  async function onSubmit(values: ParsedFormValues) {
    const payload: EventMutationInput = {
      title: values.title,
      description,
      start_date: values.start_date,
      end_date: values.end_date || null,
      registration_deadline: values.registration_deadline || null,
      event_kind: fixedKind ?? values.event_kind,
      event_type: (fixedKind ?? values.event_kind) === "tournament" ? "tournament" : values.event_type,
      visibility: values.visibility,
      team_size: Number(values.team_size),
      prize_description: values.prize_description || null,
      rules,
      logo_url: values.logo_url || null,
      banner_url: values.banner_url || null,
      status: values.status,
      scoring_win: Number(values.scoring_win),
      scoring_loss: Number(values.scoring_loss),
      scoring_draw: Number(values.scoring_draw),
      tournament_format: eventKind === "tournament" ? (values.tournament_format as EventMutationInput["tournament_format"]) || null : null,
      rounds_count: eventKind === "tournament" ? (values.rounds_count === "" ? null : Number(values.rounds_count)) : null,
      seeding_method: eventKind === "tournament" ? (values.seeding_method as EventMutationInput["seeding_method"]) || "random" : "random",
      max_teams: values.max_teams === "" ? null : Number(values.max_teams),
    };

    startTransition(async () => {
      const result = mode === "create"
        ? await createEvent(payload)
        : await updateEvent(eventId ?? "", payload);

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
    <section className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {mode === "create" ? "Novo cadastro" : "Editar cadastro"}
          </h1>
        </div>
        <AdminBadge tone="info">
          {EVENT_KIND_LABELS[(fixedKind ?? eventKind) as keyof typeof EVENT_KIND_LABELS]}
        </AdminBadge>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-200 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Nome do evento</span>
            <input {...register("title")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
            {errors.title ? <span className="text-xs text-rose-300">{errors.title.message}</span> : null}
          </label>

          {!fixedKind ? (
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Categoria</span>
              <select {...register("event_kind")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                {EVENT_KIND_VALUES.map((value) => (
                  <option key={value} value={value}>{EVENT_KIND_LABELS[value]}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Status</span>
            <select {...register("status")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
              {EVENT_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>{EVENT_STATUS_LABELS[value]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Subtipo</span>
            <select {...register("event_type")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" disabled={(fixedKind ?? eventKind) === "tournament"}>
              {EVENT_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>{EVENT_TYPE_LABELS[value]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Visibilidade</span>
            <select {...register("visibility")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
              {EVENT_VISIBILITY_VALUES.map((value) => (
                <option key={value} value={value}>{EVENT_VISIBILITY_LABELS[value]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Início</span>
            <input type="datetime-local" {...register("start_date")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
            {errors.start_date ? <span className="text-xs text-rose-300">{errors.start_date.message}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Término</span>
            <input type="datetime-local" {...register("end_date")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Limite de inscrições</span>
            <input type="datetime-local" {...register("registration_deadline")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tipo</span>
            <select {...register("team_size")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
              {TEAM_SIZE_VALUES.map((size) => (
                <option key={size} value={size}>{size}v{size}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Premiação</span>
            <textarea {...register("prize_description")} rows={3} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Logo</span>
            <input {...register("logo_url")} placeholder="https://..." className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Banner</span>
            <input {...register("banner_url")} placeholder="https://..." className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
          </label>
        </div>

        <RichTextEditor label="Descrição" value={description} onChange={setDescription} placeholder="Resumo do evento, formato e informações gerais." />
        <RichTextEditor label="Regras" value={rules} onChange={setRules} placeholder="Regras detalhadas, critérios de desempate e condutas." />

        <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Pontuação</h2>
            <p className="text-sm text-slate-400">Usada no recálculo automático do ranking ao finalizar o evento.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Vitória</span>
              <input type="number" {...register("scoring_win")} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Derrota</span>
              <input type="number" {...register("scoring_loss")} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Empate</span>
              <input type="number" {...register("scoring_draw")} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none" />
            </label>
          </div>
        </section>

        {(fixedKind === "tournament" || eventKind === "tournament") ? (
          <section className="space-y-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Configuração de torneio</h2>
              <p className="text-sm text-slate-400">Formato, rounds e cabeceamento do chaveamento.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Formato</span>
                <select {...register("tournament_format")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  {TOURNAMENT_FORMAT_VALUES.map((value) => (
                    <option key={value} value={value}>{TOURNAMENT_FORMAT_LABELS[value]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Rounds</span>
                <input type="number" {...register("rounds_count")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Seeding</span>
                <select {...register("seeding_method")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  {SEEDING_METHOD_VALUES.map((value) => (
                    <option key={value} value={value}>{SEEDING_METHOD_LABELS[value]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Máximo de equipes</span>
                <input type="number" {...register("max_teams")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" />
              </label>
            </div>
          </section>
        ) : null}

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
