"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, enforceAdminRateLimit, logAdminAction } from "@/app/admin/_lib";
import { queueOrSendDiscordNotification } from "@/lib/discord-notifications";
import {
  EVENT_KIND_VALUES,
  EVENT_TYPE_VALUES,
  EVENT_STATUS_VALUES,
  EVENT_VISIBILITY_VALUES,
  SEEDING_METHOD_VALUES,
  TOURNAMENT_FORMAT_VALUES,
  formatTeamSize,
} from "@/lib/events";

const eventStatusSchema = z.enum(EVENT_STATUS_VALUES);
const eventKindSchema = z.enum(EVENT_KIND_VALUES);
const eventTypeSchema = z.enum(EVENT_TYPE_VALUES);
const eventVisibilitySchema = z.enum(EVENT_VISIBILITY_VALUES);
const tournamentFormatSchema = z.enum(TOURNAMENT_FORMAT_VALUES);
const seedingMethodSchema = z.enum(SEEDING_METHOD_VALUES);
const registrationStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);

const eventPayloadSchema = z.object({
  title: z.string().trim().min(3, "Nome muito curto.").max(120, "Nome muito longo."),
  description: z.string().max(40000, "Descrição muito longa.").optional().nullable(),
  start_date: z.string().min(1, "Data de início obrigatória."),
  end_date: z.string().optional().nullable(),
  registration_deadline: z.string().optional().nullable(),
  event_kind: eventKindSchema,
  event_type: eventTypeSchema,
  visibility: eventVisibilitySchema,
  team_size: z.coerce.number().int().min(1).max(10),
  prize_description: z.string().max(4000, "Premiação muito longa.").optional().nullable(),
  rules: z.string().max(40000, "Regras muito longas.").optional().nullable(),
  logo_url: z.union([z.literal(""), z.url("URL do logo inválida.")]).optional().nullable(),
  banner_url: z.union([z.literal(""), z.url("URL do banner inválida.")]).optional().nullable(),
  status: eventStatusSchema,
  scoring_win: z.coerce.number().int().min(0).max(50),
  scoring_loss: z.coerce.number().int().min(0).max(50),
  scoring_draw: z.coerce.number().int().min(0).max(50),
  tournament_format: z.union([z.literal(""), tournamentFormatSchema]).optional().nullable(),
  rounds_count: z.union([z.literal(""), z.coerce.number().int().min(1).max(32)]).optional().nullable(),
  seeding_method: z.union([z.literal(""), seedingMethodSchema]).optional().nullable(),
  max_teams: z.union([z.literal(""), z.coerce.number().int().min(2).max(256)]).optional().nullable(),
});

const eventIdSchema = z.object({ eventId: z.string().uuid() });
const deleteEventSchema = z.object({ eventId: z.string().uuid() });
const registrationMutationSchema = z.object({
  eventId: z.string().uuid(),
  teamId: z.string().uuid(),
});
const rejectRegistrationSchema = registrationMutationSchema.extend({
  reason: z.string().trim().min(2, "Motivo obrigatório.").max(400, "Motivo muito longo."),
});
const addWildcardSchema = registrationMutationSchema;
const bulkRegistrationSchema = z.object({
  eventId: z.string().uuid(),
  teamIds: z.array(z.string().uuid()).min(1, "Selecione pelo menos uma equipe."),
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(400).optional().nullable(),
});

export type EventMutationInput = {
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  registration_deadline?: string | null;
  event_kind: "event" | "tournament";
  event_type: "tournament" | "special" | "scrimmage";
  visibility: "public" | "private";
  team_size: number;
  prize_description?: string | null;
  rules?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  status: "draft" | "published" | "active" | "paused" | "finished";
  scoring_win: number;
  scoring_loss: number;
  scoring_draw: number;
  tournament_format?: "single_elimination" | "double_elimination" | "round_robin" | null;
  rounds_count?: number | null;
  seeding_method?: "random" | "manual" | "ranking" | null;
  max_teams?: number | null;
};

export type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  data?: T;
};

type EventRow = EventMutationInput & {
  id: string;
  status: EventMutationInput["status"];
  created_at: string;
  prize_pool: number | null;
  published_at: string | null;
  paused_at: string | null;
  finalized_at: string | null;
  registration_deadline: string | null;
  event_type: EventMutationInput["event_type"];
  visibility: EventMutationInput["visibility"];
};

type RankingAccumulator = {
  points: number;
  wins: number;
  losses: number;
};

function normalizeOptionalText(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeOptionalDate(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.length > 0 ? new Date(text).toISOString() : null;
}

function normalizeOptionalNumber(value: number | string | null | undefined) {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
}

function getNowIso() {
  return new Date().toISOString();
}

function revalidateEventPaths(eventId?: string) {
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/events");
  revalidatePath("/admin/tournaments");
  if (eventId) {
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/bracket`);
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/admin/events/${eventId}/edit`);
    revalidatePath(`/admin/events/${eventId}/registrations`);
    revalidatePath(`/admin/tournaments/${eventId}/edit`);
  }
}

async function ensureUniqueVisibleTitle(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  title: string,
  excludeId?: string,
) {
  const { data } = await supabase
    .from("events")
    .select("id, title, status")
    .in("status", ["published", "active"])
    .ilike("title", title);

  const collision = (data ?? []).find((row) => row.id !== excludeId && String(row.title).toLowerCase() === title.toLowerCase());
  if (collision) {
    throw new Error("Já existe um evento visível com este nome.");
  }
}

function validateEventDates(
  payload: EventMutationInput,
  mode: "create" | "update",
  existingStartDate?: string | null,
) {
  const now = new Date();
  const start = new Date(payload.start_date);
  const end = payload.end_date ? new Date(payload.end_date) : null;
  const registrationDeadline = payload.registration_deadline ? new Date(payload.registration_deadline) : null;

  if (Number.isNaN(start.getTime())) {
    throw new Error("Data de início inválida.");
  }

  if (end && Number.isNaN(end.getTime())) {
    throw new Error("Data de término inválida.");
  }

  if (registrationDeadline && Number.isNaN(registrationDeadline.getTime())) {
    throw new Error("Data limite de inscrições inválida.");
  }

  if (mode === "create" && start < now) {
    throw new Error("Eventos novos não podem começar no passado.");
  }

  if (mode === "update" && existingStartDate) {
    const existing = new Date(existingStartDate);
    const startChanged = existing.toISOString() !== start.toISOString();
    if (startChanged && start < now) {
      throw new Error("A nova data de início não pode ficar no passado.");
    }
  }

  if (end && end <= start) {
    throw new Error("A data de término deve ser posterior ao início.");
  }

  if (registrationDeadline && registrationDeadline > start) {
    throw new Error("A data limite de inscrições deve ocorrer antes do início.");
  }
}

function buildStatusTimestamps(previousStatus: string | null, nextStatus: EventMutationInput["status"]) {
  const now = getNowIso();
  return {
    published_at: nextStatus === "published" && previousStatus !== "published" ? now : undefined,
    paused_at: nextStatus === "paused" && previousStatus !== "paused" ? now : undefined,
    finalized_at: nextStatus === "finished" && previousStatus !== "finished" ? now : undefined,
  };
}

function normalizeEventType(kind: EventMutationInput["event_kind"], type: EventMutationInput["event_type"]) {
  if (kind === "tournament") return "tournament" as const;
  return type;
}

async function queueTeamNotifications(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  rows: Array<{
    team_id: string;
    event_id: string;
    kind: "event_published" | "registration_approved" | "registration_rejected" | "event_starting_soon" | "event_finished";
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>,
) {
  if (rows.length === 0) return;

  await supabase.from("team_notifications").upsert(
    rows.map((row) => ({
      team_id: row.team_id,
      event_id: row.event_id,
      kind: row.kind,
      title: row.title,
      message: row.message,
      metadata: row.metadata ?? {},
      delivered_at: getNowIso(),
    })),
    { onConflict: "team_id,event_id,kind", ignoreDuplicates: false },
  );
}

async function queueEventFinishedNotifications(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  eventId: string,
  eventTitle: string,
) {
  const { data: registrations } = await supabase
    .from("registrations")
    .select("team_id")
    .eq("event_id", eventId)
    .eq("status", "approved");

  await queueTeamNotifications(
    supabase,
    (registrations ?? []).map((registration) => ({
      team_id: String(registration.team_id),
      event_id: eventId,
      kind: "event_finished" as const,
      title: `${eventTitle} foi finalizado`,
      message: `O evento ${eventTitle} foi encerrado. Confira os resultados e o ranking atualizado.`,
      metadata: { eventId },
    })),
  );
}

async function queueEventPublishedNotifications(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  eventId: string,
  eventTitle: string,
  startDate: string,
) {
  const { data: teams } = await supabase.from("teams").select("id");
  await queueTeamNotifications(
    supabase,
    (teams ?? []).map((team) => ({
      team_id: String(team.id),
      event_id: eventId,
      kind: "event_published" as const,
      title: `Evento publicado: ${eventTitle}`,
      message: `As inscrições para ${eventTitle} foram abertas. Início previsto para ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(startDate))}.`,
      metadata: { eventId },
    })),
  );
}

async function queueUpcomingStartNotifications(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  eventId: string,
  eventTitle: string,
  startDate: string,
) {
  const start = new Date(startDate);
  const diff = start.getTime() - Date.now();
  if (diff <= 0 || diff > 24 * 60 * 60 * 1000) return;

  const { data: registrations } = await supabase
    .from("registrations")
    .select("team_id")
    .eq("event_id", eventId)
    .eq("status", "approved");

  await queueTeamNotifications(
    supabase,
    (registrations ?? []).map((registration) => ({
      team_id: String(registration.team_id),
      event_id: eventId,
      kind: "event_starting_soon" as const,
      title: `${eventTitle} começa em breve`,
      message: `Seu time está confirmado. O evento começa em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(start)}.`,
      metadata: { eventId },
    })),
  );
}

async function recalculateRankings(supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"]): Promise<ActionResult> {
  const [{ data: allTeams }, { data: members }, { data: matches }, { data: events }] = await Promise.all([
    supabase.from("teams").select("id, captain_id"),
    supabase.from("team_members").select("team_id, user_id"),
    supabase.from("matches").select("event_id, team_a_id, team_b_id, winner_id, score_a, score_b"),
    supabase.from("events").select("id, scoring_win, scoring_draw, scoring_loss"),
  ]);

  const rosterByTeam = new Map<string, Set<string>>();
  for (const team of allTeams ?? []) {
    const teamId = String(team.id);
    const captainId = String(team.captain_id);
    rosterByTeam.set(teamId, new Set<string>([captainId]));
  }

  for (const member of members ?? []) {
    const teamId = String(member.team_id);
    const userId = String(member.user_id);
    const roster = rosterByTeam.get(teamId) ?? new Set<string>();
    roster.add(userId);
    rosterByTeam.set(teamId, roster);
  }

  const eventScoreMap = new Map<string, { win: number; draw: number; loss: number }>();
  for (const event of events ?? []) {
    eventScoreMap.set(String(event.id), {
      win: Number(event.scoring_win ?? 3),
      draw: Number(event.scoring_draw ?? 1),
      loss: Number(event.scoring_loss ?? 0),
    });
  }

  const standings = new Map<string, RankingAccumulator>();

  function applyToRoster(profileIds: Set<string>, updater: (acc: RankingAccumulator) => void) {
    for (const profileId of profileIds) {
      const current = standings.get(profileId) ?? { points: 0, wins: 0, losses: 0 };
      updater(current);
      standings.set(profileId, current);
    }
  }

  for (const match of matches ?? []) {
    const teamAId = String(match.team_a_id);
    const teamBId = String(match.team_b_id);
    const scoreA = Number(match.score_a ?? 0);
    const scoreB = Number(match.score_b ?? 0);
    const winnerId = match.winner_id ? String(match.winner_id) : null;
    const isFinished = scoreA !== 0 || scoreB !== 0 || winnerId !== null;

    if (!isFinished) continue;

    const rosterA = rosterByTeam.get(teamAId) ?? new Set<string>();
    const rosterB = rosterByTeam.get(teamBId) ?? new Set<string>();
    const scoring = eventScoreMap.get(String(match.event_id)) ?? { win: 3, draw: 1, loss: 0 };

    if (scoreA === scoreB) {
      applyToRoster(rosterA, (acc) => {
        acc.points += scoring.draw;
      });
      applyToRoster(rosterB, (acc) => {
        acc.points += scoring.draw;
      });
      continue;
    }

    const winnerTeamId = winnerId ?? (scoreA > scoreB ? teamAId : teamBId);
    const loserTeamId = winnerTeamId === teamAId ? teamBId : teamAId;
    const winnerRoster = winnerTeamId === teamAId ? rosterA : rosterB;
    const loserRoster = loserTeamId === teamAId ? rosterA : rosterB;

    applyToRoster(winnerRoster, (acc) => {
      acc.points += scoring.win;
      acc.wins += 1;
    });
    applyToRoster(loserRoster, (acc) => {
      acc.points += scoring.loss;
      acc.losses += 1;
    });
  }

  const sorted = [...standings.entries()].sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
    if (a[1].losses !== b[1].losses) return a[1].losses - b[1].losses;
    return a[0].localeCompare(b[0]);
  });

  const { error: deleteError } = await supabase.from("rankings").delete().gte("points", 0);
  if (deleteError) return { error: "Não foi possível recalcular o ranking." };

  if (sorted.length > 0) {
    const { error: insertError } = await supabase.from("rankings").insert(
      sorted.map(([profileId, stats], index) => ({
        profile_id: profileId,
        points: stats.points,
        wins: stats.wins,
        losses: stats.losses,
        rank_position: index + 1,
      })),
    );

    if (insertError) return { error: "Não foi possível atualizar o ranking." };
  }

  revalidatePath("/ranking");
  revalidatePath("/profile/me");
  return { success: "Ranking recalculado." };
}

async function loadEventOrThrow(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  eventId: string,
) {
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle<EventRow>();
  if (!event) throw new Error("Evento não encontrado.");
  return event;
}

function formatEventKindAction(kind: EventMutationInput["event_kind"]) {
  return kind === "tournament" ? "torneio" : "evento";
}

export async function createEvent(data: EventMutationInput): Promise<ActionResult<{ id: string }>> {
  const parsed = eventPayloadSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "create_event");

    const payload: EventMutationInput = {
      ...parsed.data,
      description: normalizeOptionalText(parsed.data.description),
      end_date: normalizeOptionalDate(parsed.data.end_date),
      registration_deadline: normalizeOptionalDate(parsed.data.registration_deadline),
      prize_description: normalizeOptionalText(parsed.data.prize_description),
      rules: normalizeOptionalText(parsed.data.rules),
      event_type: normalizeEventType(parsed.data.event_kind, parsed.data.event_type),
      visibility: parsed.data.visibility,
      logo_url: normalizeOptionalText(parsed.data.logo_url),
      banner_url: normalizeOptionalText(parsed.data.banner_url),
      tournament_format: normalizeOptionalText(parsed.data.tournament_format) as EventMutationInput["tournament_format"],
      rounds_count: normalizeOptionalNumber(parsed.data.rounds_count),
      seeding_method: (normalizeOptionalText(parsed.data.seeding_method) ?? "random") as EventMutationInput["seeding_method"],
      max_teams: normalizeOptionalNumber(parsed.data.max_teams),
      start_date: new Date(parsed.data.start_date).toISOString(),
    };

    validateEventDates(payload, "create");
    if (payload.status === "published" || payload.status === "active") {
      await ensureUniqueVisibleTitle(supabase, payload.title);
    }

    const timestamps = buildStatusTimestamps(null, payload.status);
    const insertPayload = {
      ...payload,
      prize_pool: 0,
      published_at: timestamps.published_at ?? null,
      paused_at: timestamps.paused_at ?? null,
      finalized_at: timestamps.finalized_at ?? null,
      updated_at: getNowIso(),
    };

    const { data: created, error } = await supabase.from("events").insert(insertPayload).select("id").single();
    if (error || !created) return { error: "Não foi possível criar o evento." };

    if (payload.status === "published") {
      await queueEventPublishedNotifications(supabase, String(created.id), payload.title, payload.start_date);
    }
    await queueUpcomingStartNotifications(supabase, String(created.id), payload.title, payload.start_date);

    await logAdminAction(supabase, {
      adminId,
      action: "create_event",
      targetType: "event",
      targetId: String(created.id),
      details: { title: payload.title, kind: payload.event_kind, teamSize: payload.team_size },
    });

    revalidateEventPaths(String(created.id));
    return { success: `${formatEventKindAction(payload.event_kind)} criado com sucesso.`, data: { id: String(created.id) } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao criar evento." };
  }
}

export async function updateEvent(eventId: string, data: EventMutationInput): Promise<ActionResult> {
  const parsedId = eventIdSchema.safeParse({ eventId });
  if (!parsedId.success) return { error: "Evento inválido." };

  const parsed = eventPayloadSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "update_event");

    const existing = await loadEventOrThrow(supabase, parsedId.data.eventId);
    const payload: EventMutationInput = {
      ...parsed.data,
      description: normalizeOptionalText(parsed.data.description),
      end_date: normalizeOptionalDate(parsed.data.end_date),
      registration_deadline: normalizeOptionalDate(parsed.data.registration_deadline),
      prize_description: normalizeOptionalText(parsed.data.prize_description),
      rules: normalizeOptionalText(parsed.data.rules),
      event_type: normalizeEventType(parsed.data.event_kind, parsed.data.event_type),
      visibility: parsed.data.visibility,
      logo_url: normalizeOptionalText(parsed.data.logo_url),
      banner_url: normalizeOptionalText(parsed.data.banner_url),
      tournament_format: normalizeOptionalText(parsed.data.tournament_format) as EventMutationInput["tournament_format"],
      rounds_count: normalizeOptionalNumber(parsed.data.rounds_count),
      seeding_method: (normalizeOptionalText(parsed.data.seeding_method) ?? "random") as EventMutationInput["seeding_method"],
      max_teams: normalizeOptionalNumber(parsed.data.max_teams),
      start_date: new Date(parsed.data.start_date).toISOString(),
    };

    validateEventDates(payload, "update", existing.start_date);
    if (payload.status === "published" || payload.status === "active") {
      await ensureUniqueVisibleTitle(supabase, payload.title, parsedId.data.eventId);
    }

    const timestamps = buildStatusTimestamps(existing.status, payload.status);
    const updatePayload = {
      ...payload,
      prize_pool: existing.prize_pool ?? 0,
      updated_at: getNowIso(),
      published_at: timestamps.published_at ?? existing.published_at ?? null,
      paused_at: timestamps.paused_at ?? (payload.status === "paused" ? existing.paused_at ?? getNowIso() : null),
      finalized_at: timestamps.finalized_at ?? (payload.status === "finished" ? existing.finalized_at ?? getNowIso() : null),
    };

    const { error } = await supabase.from("events").update(updatePayload).eq("id", parsedId.data.eventId);
    if (error) return { error: "Não foi possível atualizar o evento." };

    if (existing.status !== "published" && payload.status === "published") {
      await queueEventPublishedNotifications(supabase, parsedId.data.eventId, payload.title, payload.start_date);
    }
    await queueUpcomingStartNotifications(supabase, parsedId.data.eventId, payload.title, payload.start_date);

    await logAdminAction(supabase, {
      adminId,
      action: "update_event",
      targetType: "event",
      targetId: parsedId.data.eventId,
      details: { title: payload.title, kind: payload.event_kind, teamSize: formatTeamSize(payload.team_size) },
    });

    revalidateEventPaths(parsedId.data.eventId);
    return { success: `${formatEventKindAction(payload.event_kind)} atualizado com sucesso.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar evento." };
  }
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const parsed = deleteEventSchema.safeParse({ eventId });
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "delete_event");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    const { error } = await supabase.from("events").delete().eq("id", parsed.data.eventId);
    if (error) return { error: "Não foi possível deletar o evento." };

    await logAdminAction(supabase, {
      adminId,
      action: "delete_event",
      targetType: "event",
      targetId: parsed.data.eventId,
      details: { title: event.title, kind: event.event_kind },
    });

    revalidateEventPaths(parsed.data.eventId);
    return { success: `${formatEventKindAction(event.event_kind)} removido com sucesso.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao deletar evento." };
  }
}

export async function publishEvent(eventId: string): Promise<ActionResult> {
  const parsed = eventIdSchema.safeParse({ eventId });
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "publish_event");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    await ensureUniqueVisibleTitle(supabase, event.title, event.id);

    const { error } = await supabase
      .from("events")
      .update({ status: "published", published_at: getNowIso(), paused_at: null, updated_at: getNowIso() })
      .eq("id", parsed.data.eventId);
    if (error) return { error: "Não foi possível publicar o evento." };

    await queueEventPublishedNotifications(supabase, event.id, event.title, event.start_date);
    await queueUpcomingStartNotifications(supabase, event.id, event.title, event.start_date);
    if (event.event_kind === "tournament") {
      await queueOrSendDiscordNotification({
        supabase,
        createdBy: adminId,
        type: "tournament_published",
        data: {
          title: event.title,
          startDate: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.start_date)),
          eventId: event.id,
        },
      });
    }

    await logAdminAction(supabase, {
      adminId,
      action: "publish_event",
      targetType: "event",
      targetId: event.id,
      details: { title: event.title },
    });

    revalidateEventPaths(event.id);
    return { success: "Evento publicado e visível para os usuários." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao publicar evento." };
  }
}

export async function pauseEvent(eventId: string): Promise<ActionResult> {
  const parsed = eventIdSchema.safeParse({ eventId });
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "pause_event");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    const { error } = await supabase
      .from("events")
      .update({ status: "paused", paused_at: getNowIso(), updated_at: getNowIso() })
      .eq("id", event.id);
    if (error) return { error: "Não foi possível pausar o evento." };

    await logAdminAction(supabase, {
      adminId,
      action: "pause_event",
      targetType: "event",
      targetId: event.id,
      details: { title: event.title },
    });

    revalidateEventPaths(event.id);
    return { success: "Evento pausado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao pausar evento." };
  }
}

export async function activateEvent(eventId: string): Promise<ActionResult> {
  const parsed = eventIdSchema.safeParse({ eventId });
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "activate_event");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    if (event.status !== "published" && event.status !== "paused") {
      return { error: "Somente eventos publicados ou pausados podem ser ativados." };
    }

    const { error } = await supabase
      .from("events")
      .update({ status: "active", paused_at: null, updated_at: getNowIso() })
      .eq("id", event.id);
    if (error) return { error: "Não foi possível ativar o evento." };

    await logAdminAction(supabase, {
      adminId,
      action: "activate_event",
      targetType: "event",
      targetId: event.id,
      details: { title: event.title },
    });

    revalidateEventPaths(event.id);
    return { success: "Evento ativado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao ativar evento." };
  }
}

export async function finalizeEvent(eventId: string): Promise<ActionResult> {
  const parsed = eventIdSchema.safeParse({ eventId });
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "finalize_event");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    const { error } = await supabase
      .from("events")
      .update({ status: "finished", finalized_at: getNowIso(), updated_at: getNowIso() })
      .eq("id", event.id);
    if (error) return { error: "Não foi possível finalizar o evento." };

    const rankingResult = await recalculateRankings(supabase);
    if (rankingResult.error) return rankingResult;

    await queueEventFinishedNotifications(supabase, event.id, event.title);

    await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "event_finalized",
      data: {
        title: event.title,
        eventId: event.id,
      },
    });

    await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "ranking_updated",
      data: { source: `finalize_event:${event.id}` },
    });

    await logAdminAction(supabase, {
      adminId,
      action: "finalize_event",
      targetType: "event",
      targetId: event.id,
      details: { title: event.title },
    });

    revalidateEventPaths(event.id);
    return { success: "Evento finalizado e ranking recalculado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao finalizar evento." };
  }
}

export async function duplicateEvent(eventId: string): Promise<ActionResult<{ id: string }>> {
  const parsed = eventIdSchema.safeParse({ eventId });
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "duplicate_event");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    const currentStart = new Date(event.start_date);
    const currentEnd = event.end_date ? new Date(event.end_date) : null;
    const currentDeadline = event.registration_deadline ? new Date(event.registration_deadline) : null;
    const baseStart = currentStart.getTime() < Date.now() ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : currentStart;
    const duration = currentEnd ? currentEnd.getTime() - currentStart.getTime() : null;
    const deadlineDelta = currentDeadline ? currentStart.getTime() - currentDeadline.getTime() : null;

    let copyTitle = `${event.title} (cópia)`;
    for (let index = 2; index <= 20; index += 1) {
      const { data: existing } = await supabase.from("events").select("id").ilike("title", copyTitle).limit(1);
      if (!existing || existing.length === 0) break;
      copyTitle = `${event.title} (cópia ${index})`;
    }

    const insertPayload = {
      title: copyTitle,
      description: event.description,
      start_date: baseStart.toISOString(),
      end_date: duration ? new Date(baseStart.getTime() + duration).toISOString() : null,
      registration_deadline: deadlineDelta ? new Date(baseStart.getTime() - deadlineDelta).toISOString() : null,
      event_kind: event.event_kind,
      event_type: event.event_type,
      visibility: event.visibility,
      team_size: event.team_size,
      prize_description: event.prize_description,
      rules: event.rules,
      logo_url: event.logo_url,
      banner_url: event.banner_url,
      status: "draft",
      scoring_win: event.scoring_win,
      scoring_loss: event.scoring_loss,
      scoring_draw: event.scoring_draw,
      tournament_format: event.tournament_format,
      rounds_count: event.rounds_count,
      seeding_method: event.seeding_method,
      max_teams: event.max_teams,
      prize_pool: event.prize_pool ?? 0,
      duplicated_from: event.id,
      updated_at: getNowIso(),
    };

    const { data: created, error } = await supabase.from("events").insert(insertPayload).select("id").single();
    if (error || !created) return { error: "Não foi possível duplicar o evento." };

    await logAdminAction(supabase, {
      adminId,
      action: "duplicate_event",
      targetType: "event",
      targetId: String(created.id),
      details: { sourceEventId: event.id, title: copyTitle },
    });

    revalidateEventPaths(String(created.id));
    return { success: "Evento duplicado com sucesso.", data: { id: String(created.id) } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao duplicar evento." };
  }
}

export async function approveRegistration(eventId: string, teamId: string): Promise<ActionResult> {
  const parsed = registrationMutationSchema.safeParse({ eventId, teamId });
  if (!parsed.success) return { error: "Inscrição inválida." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "approve_registration");

    const [event, registration] = await Promise.all([
      loadEventOrThrow(supabase, parsed.data.eventId),
      supabase
        .from("registrations")
        .select("id, status")
        .eq("event_id", parsed.data.eventId)
        .eq("team_id", parsed.data.teamId)
        .maybeSingle<{ id: string; status: z.infer<typeof registrationStatusSchema> }>(),
    ]);

    if (!registration.data) return { error: "Inscrição não encontrada." };

    if (event.max_teams) {
      const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", parsed.data.eventId)
        .eq("status", "approved");
      if ((count ?? 0) >= event.max_teams && registration.data.status !== "approved") {
        return { error: "Limite máximo de equipes aprovadas atingido." };
      }
    }

    const { error } = await supabase
      .from("registrations")
      .update({
        status: "approved",
        reviewed_at: getNowIso(),
        reviewed_by: adminId,
        rejection_reason: null,
        updated_at: getNowIso(),
      })
      .eq("event_id", parsed.data.eventId)
      .eq("team_id", parsed.data.teamId);
    if (error) return { error: "Não foi possível aprovar a inscrição." };

    const { data: team } = await supabase.from("teams").select("name").eq("id", parsed.data.teamId).maybeSingle<{ name: string }>();

    await queueTeamNotifications(supabase, [
      {
        team_id: parsed.data.teamId,
        event_id: parsed.data.eventId,
        kind: "registration_approved",
        title: `${event.title}: inscrição aprovada`,
        message: `Sua equipe foi aprovada para participar de ${event.title}.`,
        metadata: { eventId: event.id },
      },
    ]);
    await queueUpcomingStartNotifications(supabase, event.id, event.title, event.start_date);
    await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "registration_approved",
      data: {
        teamName: team?.name ?? parsed.data.teamId,
        eventTitle: event.title,
        eventId: event.id,
      },
    });

    await logAdminAction(supabase, {
      adminId,
      action: "approve_registration",
      targetType: "registration",
      targetId: `${parsed.data.eventId}:${parsed.data.teamId}`,
      details: { eventId: parsed.data.eventId, teamId: parsed.data.teamId },
    });

    revalidateEventPaths(parsed.data.eventId);
    return { success: "Inscrição aprovada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao aprovar inscrição." };
  }
}

export async function rejectRegistration(eventId: string, teamId: string, reason: string): Promise<ActionResult> {
  const parsed = rejectRegistrationSchema.safeParse({ eventId, teamId, reason });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "reject_registration");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    const { error } = await supabase
      .from("registrations")
      .update({
        status: "rejected",
        reviewed_at: getNowIso(),
        reviewed_by: adminId,
        rejection_reason: parsed.data.reason,
        updated_at: getNowIso(),
      })
      .eq("event_id", parsed.data.eventId)
      .eq("team_id", parsed.data.teamId);
    if (error) return { error: "Não foi possível rejeitar a inscrição." };

    const { data: team } = await supabase.from("teams").select("name").eq("id", parsed.data.teamId).maybeSingle<{ name: string }>();

    await queueTeamNotifications(supabase, [
      {
        team_id: parsed.data.teamId,
        event_id: parsed.data.eventId,
        kind: "registration_rejected",
        title: `${event.title}: inscrição rejeitada`,
        message: `Sua inscrição foi rejeitada. Motivo: ${parsed.data.reason}`,
        metadata: { eventId: event.id, reason: parsed.data.reason },
      },
    ]);
    await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "registration_rejected",
      data: {
        teamName: team?.name ?? parsed.data.teamId,
        eventTitle: event.title,
        eventId: event.id,
        reason: parsed.data.reason,
      },
    });

    await logAdminAction(supabase, {
      adminId,
      action: "reject_registration",
      targetType: "registration",
      targetId: `${parsed.data.eventId}:${parsed.data.teamId}`,
      details: { eventId: parsed.data.eventId, teamId: parsed.data.teamId, reason: parsed.data.reason },
    });

    revalidateEventPaths(parsed.data.eventId);
    return { success: "Inscrição rejeitada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao rejeitar inscrição." };
  }
}

export async function bulkManageRegistrations(
  eventId: string,
  teamIds: string[],
  action: "approve" | "reject",
  reason?: string | null,
): Promise<ActionResult> {
  const parsed = bulkRegistrationSchema.safeParse({ eventId, teamIds, action, reason });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    for (const teamId of parsed.data.teamIds) {
      const result = parsed.data.action === "approve"
        ? await approveRegistration(parsed.data.eventId, teamId)
        : await rejectRegistration(parsed.data.eventId, teamId, parsed.data.reason?.trim() || "Rejeitado pela administração.");
      if (result.error) return result;
    }

    return {
      success:
        parsed.data.action === "approve"
          ? "Inscrições aprovadas em lote."
          : "Inscrições rejeitadas em lote.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha na ação em lote." };
  }
}

export async function addWildcardRegistration(eventId: string, teamId: string): Promise<ActionResult> {
  const parsed = addWildcardSchema.safeParse({ eventId, teamId });
  if (!parsed.success) return { error: "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "add_wildcard_registration");

    const event = await loadEventOrThrow(supabase, parsed.data.eventId);
    if (event.max_teams) {
      const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", parsed.data.eventId)
        .eq("status", "approved");
      if ((count ?? 0) >= event.max_teams) {
        return { error: "Limite máximo de equipes aprovadas atingido." };
      }
    }

    const { error } = await supabase.from("registrations").upsert(
      {
        event_id: parsed.data.eventId,
        team_id: parsed.data.teamId,
        status: "approved",
        source: "wildcard",
        created_by: adminId,
        reviewed_by: adminId,
        reviewed_at: getNowIso(),
        rejection_reason: null,
        updated_at: getNowIso(),
      },
      { onConflict: "event_id,team_id" },
    );
    if (error) return { error: "Não foi possível adicionar a equipe manualmente." };

    await queueTeamNotifications(supabase, [
      {
        team_id: parsed.data.teamId,
        event_id: parsed.data.eventId,
        kind: "registration_approved",
        title: `${event.title}: vaga wildcard confirmada`,
        message: `Sua equipe foi adicionada manualmente ao evento ${event.title}.`,
        metadata: { eventId: event.id, source: "wildcard" },
      },
    ]);
    await queueUpcomingStartNotifications(supabase, event.id, event.title, event.start_date);

    await logAdminAction(supabase, {
      adminId,
      action: "add_wildcard_registration",
      targetType: "registration",
      targetId: `${parsed.data.eventId}:${parsed.data.teamId}`,
      details: { eventId: parsed.data.eventId, teamId: parsed.data.teamId },
    });

    revalidateEventPaths(parsed.data.eventId);
    return { success: "Equipe adicionada manualmente ao evento." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao adicionar wildcard." };
  }
}

export async function removeRegistration(eventId: string, teamId: string): Promise<ActionResult> {
  const parsed = registrationMutationSchema.safeParse({ eventId, teamId });
  if (!parsed.success) return { error: "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "remove_registration");

    const { error } = await supabase
      .from("registrations")
      .delete()
      .eq("event_id", parsed.data.eventId)
      .eq("team_id", parsed.data.teamId);
    if (error) return { error: "Não foi possível remover a inscrição." };

    await logAdminAction(supabase, {
      adminId,
      action: "remove_registration",
      targetType: "registration",
      targetId: `${parsed.data.eventId}:${parsed.data.teamId}`,
      details: { eventId: parsed.data.eventId, teamId: parsed.data.teamId },
    });

    revalidateEventPaths(parsed.data.eventId);
    return { success: "Inscrição removida com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao remover inscrição." };
  }
}
