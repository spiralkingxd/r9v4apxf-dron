"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateRanking } from "@/app/events/actions";
import { createClient } from "@/lib/supabase/server";

const eventStatusSchema = z.enum(["draft", "active", "finished"]);

const createEventSchema = z.object({
  title: z.string().min(3, "Titulo muito curto.").max(120),
  description: z.string().max(4000).optional(),
  rules: z.string().max(20000).optional(),
  status: eventStatusSchema,
  start_date: z.string().min(1, "Data de inicio obrigatoria."),
  end_date: z.string().optional(),
  prize_pool: z.coerce.number().min(0),
});

const updateEventSchema = createEventSchema.extend({
  event_id: z.string().uuid(),
});

const deleteEventSchema = z.object({
  event_id: z.string().uuid(),
});

const deleteTeamSchema = z.object({
  team_id: z.string().uuid(),
});

const promoteUserSchema = z.object({
  user_id: z.string().uuid(),
});

const updateMatchSchema = z.object({
  event_id: z.string().uuid(),
  match_id: z.string().uuid(),
  team_a_id: z.string().uuid(),
  team_b_id: z.string().uuid(),
  score_a: z.coerce.number().int().min(0),
  score_b: z.coerce.number().int().min(0),
});

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return { supabase };
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeOptionalDate(value: string) {
  const text = value.trim();
  return text.length > 0 ? text : null;
}

export async function createEventAction(formData: FormData): Promise<void> {
  const { supabase } = await assertAdmin();

  const parsed = createEventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    rules: formData.get("rules"),
    status: formData.get("status"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    prize_pool: formData.get("prize_pool"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos.");
  }

  const { description, end_date, prize_pool, rules, start_date, status, title } = parsed.data;

  await supabase.from("events").insert({
    title,
    description: normalizeOptionalText(description ?? ""),
    rules: normalizeOptionalText(rules ?? ""),
    status,
    start_date,
    end_date: normalizeOptionalDate(end_date ?? ""),
    prize_pool,
  });

  revalidatePath("/events");
  revalidatePath("/admin/dashboard");
}

export async function updateEventAction(formData: FormData): Promise<void> {
  const { supabase } = await assertAdmin();

  const parsed = updateEventSchema.safeParse({
    event_id: formData.get("event_id"),
    title: formData.get("title"),
    description: formData.get("description"),
    rules: formData.get("rules"),
    status: formData.get("status"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    prize_pool: formData.get("prize_pool"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos.");
  }

  const { event_id, description, end_date, prize_pool, rules, start_date, status, title } = parsed.data;

  await supabase
    .from("events")
    .update({
      title,
      description: normalizeOptionalText(description ?? ""),
      rules: normalizeOptionalText(rules ?? ""),
      status,
      start_date,
      end_date: normalizeOptionalDate(end_date ?? ""),
      prize_pool,
    })
    .eq("id", event_id);

  revalidatePath("/events");
  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/bracket`);
  revalidatePath("/admin/dashboard");
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const { supabase } = await assertAdmin();

  const parsed = deleteEventSchema.safeParse({
    event_id: formData.get("event_id"),
  });

  if (!parsed.success) {
    throw new Error("Evento invalido.");
  }

  await supabase.from("events").delete().eq("id", parsed.data.event_id);

  revalidatePath("/events");
  revalidatePath("/admin/dashboard");
}

export async function banTeamAction(formData: FormData): Promise<void> {
  const { supabase } = await assertAdmin();

  const parsed = deleteTeamSchema.safeParse({
    team_id: formData.get("team_id"),
  });

  if (!parsed.success) {
    throw new Error("Time invalido.");
  }

  await supabase.from("teams").delete().eq("id", parsed.data.team_id);

  revalidatePath("/teams");
  revalidatePath("/admin/dashboard");
}

export async function promoteUserToAdminAction(formData: FormData): Promise<void> {
  const { supabase } = await assertAdmin();

  const parsed = promoteUserSchema.safeParse({
    user_id: formData.get("user_id"),
  });

  if (!parsed.success) {
    throw new Error("Usuario invalido.");
  }

  await supabase.from("profiles").update({ role: "admin" }).eq("id", parsed.data.user_id);

  revalidatePath("/admin/dashboard");
}

export async function updateMatchResultAdminAction(formData: FormData): Promise<void> {
  const { supabase } = await assertAdmin();

  const parsed = updateMatchSchema.safeParse({
    event_id: formData.get("event_id"),
    match_id: formData.get("match_id"),
    team_a_id: formData.get("team_a_id"),
    team_b_id: formData.get("team_b_id"),
    score_a: formData.get("score_a"),
    score_b: formData.get("score_b"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos.");
  }

  const { event_id, match_id, score_a, score_b, team_a_id, team_b_id } = parsed.data;
  const winnerId = score_a === score_b ? null : score_a > score_b ? team_a_id : team_b_id;

  await supabase
    .from("matches")
    .update({
      score_a,
      score_b,
      winner_id: winnerId,
    })
    .eq("id", match_id)
    .eq("event_id", event_id);

  const rankingForm = new FormData();
  rankingForm.set("match_id", match_id);
  await updateRanking(rankingForm);

  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/bracket`);
  revalidatePath("/ranking");
  revalidatePath("/admin/dashboard");
}
