"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, enforceAdminRateLimit, logAdminAction } from "@/app/admin/_lib";
import { queueOrSendDiscordNotification } from "@/lib/discord-notifications";
import { insertNotifications } from "@/lib/notifications";

type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  data?: T;
};

type MatchRow = {
  id: string;
  event_id: string;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  score_a: number;
  score_b: number;
  round: number;
  bracket_position: string | null;
  status: "pending" | "in_progress" | "finished" | "cancelled";
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  evidence: Array<{ type: "image" | "link"; url: string; label?: string }>;
  cancel_reason: string | null;
  updated_at: string;
  updated_by: string | null;
  next_match_id: string | null;
  next_slot: "team_a" | "team_b" | null;
};

type EventLite = {
  id: string;
  title: string;
  status: "draft" | "published" | "active" | "paused" | "finished";
  scoring_win: number;
  scoring_draw: number;
  scoring_loss: number;
  seeding_method: "random" | "manual" | "ranking";
};

const createMatchSchema = z.object({
  eventId: z.string().uuid(),
  teamAId: z.string().uuid(),
  teamBId: z.string().uuid(),
  round: z.coerce.number().int().min(1).max(64),
  scheduledAt: z.string().optional().nullable(),
});

const updateScoreSchema = z.object({
  matchId: z.string().uuid(),
  scoreA: z.coerce.number().int().min(0).max(99),
  scoreB: z.coerce.number().int().min(0).max(99),
});

const setWinnerSchema = z.object({
  matchId: z.string().uuid(),
  winnerId: z.union([z.literal("draw"), z.string().uuid()]),
});

const cancelMatchSchema = z.object({
  matchId: z.string().uuid(),
  reason: z.string().trim().min(2).max(400),
});

const reopenMatchSchema = z.object({
  matchId: z.string().uuid(),
});

const generateBracketSchema = z.object({
  eventId: z.string().uuid(),
  format: z.enum(["single_elimination", "double_elimination", "round_robin"]),
});

const advanceWinnerSchema = z.object({
  matchId: z.string().uuid(),
});

const revertSchema = z.object({
  matchId: z.string().uuid(),
});

const updateDetailsSchema = z.object({
  matchId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "finished", "cancelled"]).optional(),
  scheduled_at: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  ended_at: z.string().optional().nullable(),
  duration_minutes: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  evidence: z.array(z.object({ type: z.enum(["image", "link"]), url: z.url(), label: z.string().max(120).optional() })).optional(),
  cancel_reason: z.string().max(400).optional().nullable(),
  note: z.string().max(400).optional().nullable(),
});

function isoOrNull(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function revalidateMatchPaths(eventId?: string, matchId?: string) {
  revalidatePath("/admin/results");
  revalidatePath("/admin/dashboard");
  if (eventId) {
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/bracket`);
    revalidatePath(`/admin/tournaments/${eventId}`);
    revalidatePath(`/admin/tournaments/${eventId}/bracket`);
    revalidatePath(`/admin/tournaments/${eventId}/registrations`);
    revalidatePath(`/admin/tournaments/${eventId}/matches`);
    if (matchId) {
      revalidatePath(`/admin/tournaments/${eventId}/matches/${matchId}`);
    }
  }
}

async function getEventOrThrow(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  eventId: string,
) {
  const { data: event } = await supabase
    .from("events")
    .select("id, title, status, scoring_win, scoring_draw, scoring_loss, seeding_method")
    .eq("id", eventId)
    .maybeSingle<EventLite>();

  if (!event) throw new Error("Evento não encontrado.");
  return event;
}

async function assertEventEditable(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  eventId: string,
) {
  const event = await getEventOrThrow(supabase, eventId);
  if (event.status === "finished") {
    throw new Error("Não é permitido editar partidas de evento finalizado.");
  }
  return event;
}

async function getMatchOrThrow(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  matchId: string,
) {
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle<MatchRow>();
  if (!match) throw new Error("Partida não encontrada.");
  const event = await assertEventEditable(supabase, match.event_id);
  return { match, event };
}

async function writeMatchLog(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  payload: {
    matchId: string;
    eventId: string;
    adminId: string;
    action: string;
    note?: string | null;
    previousState?: Record<string, unknown>;
    nextState?: Record<string, unknown>;
  },
) {
  await supabase.from("match_result_logs").insert({
    match_id: payload.matchId,
    event_id: payload.eventId,
    admin_user_id: payload.adminId,
    action: payload.action,
    note: payload.note ?? null,
    previous_state: payload.previousState ?? {},
    next_state: payload.nextState ?? {},
  });
}

async function recalculateRankings(supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"]) {
  const [{ data: allTeams }, { data: members }, { data: matches }, { data: events }, { data: registrations }] = await Promise.all([
    supabase.from("teams").select("id, captain_id"),
    supabase.from("team_members").select("team_id, user_id"),
    supabase.from("matches").select("event_id, team_a_id, team_b_id, winner_id, score_a, score_b, status, next_match_id"),
    supabase.from("events").select("id, status, scoring_win, scoring_draw, scoring_loss"),
    supabase.from("registrations").select("event_id, team_id, status").eq("status", "approved"),
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

  const eventScoreMap = new Map<string, { win: number; draw: number; loss: number; status: string }>();
  for (const event of events ?? []) {
    eventScoreMap.set(String(event.id), {
      win: Number(event.scoring_win ?? 3),
      draw: Number(event.scoring_draw ?? 1),
      loss: Number(event.scoring_loss ?? 0),
      status: String(event.status ?? "draft"),
    });
  }

  const approvedTeamsByEvent = new Map<string, Set<string>>();
  for (const registration of registrations ?? []) {
    const eventId = String(registration.event_id ?? "");
    const teamId = String(registration.team_id ?? "");
    if (!eventId || !teamId) continue;
    const current = approvedTeamsByEvent.get(eventId) ?? new Set<string>();
    current.add(teamId);
    approvedTeamsByEvent.set(eventId, current);
  }

  const standings = new Map<string, { points: number; wins: number; losses: number }>();
  const teamStandings = new Map<string, { points: number; wins: number; losses: number }>();

  function applyToRoster(profileIds: Set<string>, updater: (acc: { points: number; wins: number; losses: number }) => void) {
    for (const profileId of profileIds) {
      const current = standings.get(profileId) ?? { points: 0, wins: 0, losses: 0 };
      updater(current);
      standings.set(profileId, current);
    }
  }

  function applyToTeam(teamId: string, updater: (acc: { points: number; wins: number; losses: number }) => void) {
    const current = teamStandings.get(teamId) ?? { points: 0, wins: 0, losses: 0 };
    updater(current);
    teamStandings.set(teamId, current);
  }

  const terminalWinnersByEvent = new Map<string, Set<string>>();

  for (const match of matches ?? []) {
    if (match.status !== "finished") continue;
    if (!match.team_a_id || !match.team_b_id) continue;

    const teamAId = String(match.team_a_id);
    const teamBId = String(match.team_b_id);
    const scoreA = Number(match.score_a ?? 0);
    const scoreB = Number(match.score_b ?? 0);
    const winnerId = match.winner_id ? String(match.winner_id) : null;
    const rosterA = rosterByTeam.get(teamAId) ?? new Set<string>();
    const rosterB = rosterByTeam.get(teamBId) ?? new Set<string>();
    const scoring = eventScoreMap.get(String(match.event_id)) ?? { win: 3, draw: 1, loss: 0 };

    if (!winnerId || scoreA === scoreB) {
      applyToRoster(rosterA, (acc) => {
        acc.points += scoring.draw;
      });
      applyToRoster(rosterB, (acc) => {
        acc.points += scoring.draw;
      });
      applyToTeam(teamAId, (acc) => {
        acc.points += scoring.draw;
      });
      applyToTeam(teamBId, (acc) => {
        acc.points += scoring.draw;
      });
      continue;
    }

    const winnerTeamId = winnerId;
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

    applyToTeam(winnerTeamId, (acc) => {
      acc.points += scoring.win;
      acc.wins += 1;
    });
    applyToTeam(loserTeamId, (acc) => {
      acc.points += scoring.loss;
      acc.losses += 1;
    });

    if (!match.next_match_id) {
      const winners = terminalWinnersByEvent.get(String(match.event_id)) ?? new Set<string>();
      winners.add(winnerTeamId);
      terminalWinnersByEvent.set(String(match.event_id), winners);
    }
  }

  for (const [eventId, scoring] of eventScoreMap.entries()) {
    if (scoring.status !== "finished") continue;

    const approvedTeams = approvedTeamsByEvent.get(eventId);
    const terminalWinners = terminalWinnersByEvent.get(eventId);
    if (!approvedTeams || approvedTeams.size < 2 || !terminalWinners || terminalWinners.size !== 1) continue;

    const championTeamId = [...terminalWinners][0];
    for (const teamId of approvedTeams) {
      if (teamId === championTeamId) continue;

      const roster = rosterByTeam.get(teamId) ?? new Set<string>();
      applyToTeam(teamId, (acc) => {
        acc.points += scoring.loss;
        acc.losses += 1;
      });
      applyToRoster(roster, (acc) => {
        acc.points += scoring.loss;
        acc.losses += 1;
      });
    }
  }

  const sorted = [...standings.entries()].sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
    if (a[1].losses !== b[1].losses) return a[1].losses - b[1].losses;
    return a[0].localeCompare(b[0]);
  });

  const sortedTeams = [...teamStandings.entries()].sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
    if (a[1].losses !== b[1].losses) return a[1].losses - b[1].losses;
    return a[0].localeCompare(b[0]);
  });

  await Promise.all([
    supabase.from("rankings").delete().gte("points", 0),
    supabase.from("team_rankings").delete().gte("points", 0),
  ]);

  if (sorted.length > 0) {
    await supabase.from("rankings").insert(
      sorted.map(([profileId, stats], index) => ({
        profile_id: profileId,
        points: stats.points,
        wins: stats.wins,
        losses: stats.losses,
        rank_position: index + 1,
      })),
    );
  }

  if (sortedTeams.length > 0) {
    await supabase.from("team_rankings").insert(
      sortedTeams.map(([teamId, stats], index) => ({
        team_id: teamId,
        points: stats.points,
        wins: stats.wins,
        losses: stats.losses,
        rank_position: index + 1,
        updated_at: nowIso(),
      })),
    );
  }

  revalidatePath("/ranking");
  revalidatePath("/profile/me");
  revalidatePath("/admin/rankings");
  revalidatePath("/admin/dashboard");
}

async function pushWinnerToNextMatch(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  match: MatchRow,
  winnerTeamId: string,
) {
  if (!match.next_match_id || !match.next_slot) return;

  const updatePayload = match.next_slot === "team_a"
    ? { team_a_id: winnerTeamId, updated_at: nowIso() }
    : { team_b_id: winnerTeamId, updated_at: nowIso() };

  await supabase.from("matches").update(updatePayload).eq("id", match.next_match_id);
}

function shuffle<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nextPowerOfTwo(value: number) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

async function getSeededTeamOrder(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  event: EventLite,
  teamIds: string[],
) {
  if (event.seeding_method !== "ranking") {
    return event.seeding_method === "manual" ? teamIds : shuffle(teamIds);
  }

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("team_id, user_id")
    .in("team_id", teamIds);

  const { data: teams } = await supabase.from("teams").select("id, captain_id").in("id", teamIds);
  const allProfileIds = new Set<string>();
  for (const row of teamMembers ?? []) allProfileIds.add(String(row.user_id));
  for (const row of teams ?? []) allProfileIds.add(String(row.captain_id));

  const ids = [...allProfileIds];
  const { data: rankings } = ids.length > 0
    ? await supabase.from("rankings").select("profile_id, points").in("profile_id", ids)
    : { data: [] };

  const pointsByProfile = new Map<string, number>();
  for (const row of rankings ?? []) {
    pointsByProfile.set(String(row.profile_id), Number(row.points ?? 0));
  }

  const membersByTeam = new Map<string, Set<string>>();
  for (const team of teams ?? []) {
    membersByTeam.set(String(team.id), new Set<string>([String(team.captain_id)]));
  }
  for (const member of teamMembers ?? []) {
    const teamId = String(member.team_id);
    const set = membersByTeam.get(teamId) ?? new Set<string>();
    set.add(String(member.user_id));
    membersByTeam.set(teamId, set);
  }

  return [...teamIds].sort((a, b) => {
    const aMembers = membersByTeam.get(a) ?? new Set<string>();
    const bMembers = membersByTeam.get(b) ?? new Set<string>();
    const aPoints = [...aMembers].reduce((acc, profileId) => acc + (pointsByProfile.get(profileId) ?? 0), 0);
    const bPoints = [...bMembers].reduce((acc, profileId) => acc + (pointsByProfile.get(profileId) ?? 0), 0);
    if (bPoints !== aPoints) return bPoints - aPoints;
    return a.localeCompare(b);
  });
}

export async function createMatch(
  eventId: string,
  teamAId: string,
  teamBId: string,
  round: number,
  scheduledAt?: string | null,
  _adminId?: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createMatchSchema.safeParse({ eventId, teamAId, teamBId, round, scheduledAt });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.teamAId === parsed.data.teamBId) return { error: "Equipe A e B não podem ser iguais." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "create_match");
    await assertEventEditable(supabase, parsed.data.eventId);

    const { data: created, error } = await supabase
      .from("matches")
      .insert({
        event_id: parsed.data.eventId,
        team_a_id: parsed.data.teamAId,
        team_b_id: parsed.data.teamBId,
        round: parsed.data.round,
        bracket_position: `R${parsed.data.round}-Mcustom-${Date.now()}`,
        status: "pending",
        scheduled_at: isoOrNull(parsed.data.scheduledAt),
        updated_at: nowIso(),
        updated_by: adminId,
      })
      .select("id")
      .single();

    if (error || !created) return { error: "Não foi possível criar a partida." };

    await logAdminAction(supabase, {
      adminId,
      action: "create_match",
      targetType: "match",
      targetId: String(created.id),
      details: { eventId: parsed.data.eventId, teamAId: parsed.data.teamAId, teamBId: parsed.data.teamBId, round: parsed.data.round },
    });

    await writeMatchLog(supabase, {
      matchId: String(created.id),
      eventId: parsed.data.eventId,
      adminId,
      action: "create_match",
      nextState: { team_a_id: parsed.data.teamAId, team_b_id: parsed.data.teamBId, round: parsed.data.round },
    });

    if (parsed.data.scheduledAt) {
      const [{ data: teamA }, { data: teamB }, { data: event }] = await Promise.all([
        supabase.from("teams").select("name").eq("id", parsed.data.teamAId).maybeSingle<{ name: string }>(),
        supabase.from("teams").select("name").eq("id", parsed.data.teamBId).maybeSingle<{ name: string }>(),
        supabase.from("events").select("title").eq("id", parsed.data.eventId).maybeSingle<{ title: string }>(),
      ]);

      await queueOrSendDiscordNotification({
        supabase,
        createdBy: adminId,
        type: "match_scheduled",
        data: {
          eventTitle: event?.title ?? parsed.data.eventId,
          teamA: teamA?.name ?? parsed.data.teamAId,
          teamB: teamB?.name ?? parsed.data.teamBId,
          scheduledAt: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(parsed.data.scheduledAt)),
        },
      });
    }

    revalidateMatchPaths(parsed.data.eventId, String(created.id));
    return { success: "Partida criada com sucesso.", data: { id: String(created.id) } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao criar partida." };
  }
}

export async function updateMatchScore(matchId: string, scoreA: number, scoreB: number, _adminId?: string): Promise<ActionResult> {
  const parsed = updateScoreSchema.safeParse({ matchId, scoreA, scoreB });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "update_match_score");
    const { match, event } = await getMatchOrThrow(supabase, parsed.data.matchId);

    const nextStatus = match.status === "cancelled"
      ? "cancelled"
      : parsed.data.scoreA !== 0 || parsed.data.scoreB !== 0
        ? "in_progress"
        : "pending";

    const previous = { score_a: match.score_a, score_b: match.score_b, status: match.status };
    const next = { score_a: parsed.data.scoreA, score_b: parsed.data.scoreB, status: nextStatus };

    const { error } = await supabase
      .from("matches")
      .update({
        score_a: parsed.data.scoreA,
        score_b: parsed.data.scoreB,
        status: nextStatus,
        started_at: nextStatus === "in_progress" ? match.started_at ?? nowIso() : match.started_at,
        updated_at: nowIso(),
        updated_by: adminId,
      })
      .eq("id", match.id);

    if (error) return { error: "Não foi possível atualizar placar." };

    await writeMatchLog(supabase, {
      matchId: match.id,
      eventId: match.event_id,
      adminId,
      action: "update_match_score",
      previousState: previous,
      nextState: next,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "update_match_score",
      targetType: "match",
      targetId: match.id,
      details: { eventId: match.event_id, scoreA: parsed.data.scoreA, scoreB: parsed.data.scoreB },
    });

    revalidateMatchPaths(event.id, match.id);
    return { success: "Placar atualizado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar placar." };
  }
}

export async function setMatchWinner(matchId: string, winnerId: string | "draw", _adminId?: string): Promise<ActionResult> {
  const parsed = setWinnerSchema.safeParse({ matchId, winnerId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "set_match_winner");
    const { match, event } = await getMatchOrThrow(supabase, parsed.data.matchId);

    if (!match.team_a_id || !match.team_b_id) {
      return { error: "A partida precisa ter as duas equipes definidas." };
    }

    const hasScore = match.score_a !== 0 || match.score_b !== 0;
    if (!hasScore) {
      return { error: "Partidas só podem ser finalizadas se tiverem placar." };
    }

    let winner: string | null = null;
    if (parsed.data.winnerId !== "draw") {
      if (parsed.data.winnerId !== match.team_a_id && parsed.data.winnerId !== match.team_b_id) {
        return { error: "Vencedor deve ser uma das equipes da partida." };
      }
      winner = parsed.data.winnerId;
    }

    const previous = { winner_id: match.winner_id, status: match.status, ended_at: match.ended_at };
    const next = { winner_id: winner, status: "finished", ended_at: nowIso() };

    const { error } = await supabase
      .from("matches")
      .update({
        winner_id: winner,
        status: "finished",
        ended_at: nowIso(),
        duration_minutes:
          match.started_at && !match.duration_minutes
            ? Math.max(0, Math.round((Date.now() - new Date(match.started_at).getTime()) / 60000))
            : match.duration_minutes,
        updated_at: nowIso(),
        updated_by: adminId,
      })
      .eq("id", match.id);

    if (error) return { error: "Não foi possível definir vencedor." };

    if (winner) {
      const refreshed = { ...match, winner_id: winner, status: "finished" as const };
      await pushWinnerToNextMatch(supabase, refreshed, winner);
    }

    await recalculateRankings(supabase);

    await writeMatchLog(supabase, {
      matchId: match.id,
      eventId: match.event_id,
      adminId,
      action: "set_match_winner",
      previousState: previous,
      nextState: next,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "set_match_winner",
      targetType: "match",
      targetId: match.id,
      details: { eventId: match.event_id, winnerId: winner ?? "draw" },
    });

    const [{ data: teamA }, { data: teamB }] = await Promise.all([
      supabase.from("teams").select("name").eq("id", match.team_a_id).maybeSingle<{ name: string }>(),
      supabase.from("teams").select("name").eq("id", match.team_b_id).maybeSingle<{ name: string }>(),
    ]);
    const winnerName = winner ? (winner === match.team_a_id ? teamA?.name : teamB?.name) : "Empate";

    if (winner && (previous.status !== "finished" || previous.winner_id !== winner)) {
      const { data: winnerTeam } = await supabase
        .from("teams")
        .select("id, name, captain_id")
        .eq("id", winner)
        .maybeSingle<{ id: string; name: string; captain_id: string }>();

      if (winnerTeam) {
        const { data: winnerMembers } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", winnerTeam.id);

        const winnerUserIds = Array.from(
          new Set([
            winnerTeam.captain_id,
            ...(winnerMembers ?? []).map((row) => String(row.user_id)),
          ].filter(Boolean)),
        );

        if (winnerUserIds.length > 0) {
          await insertNotifications(
            supabase,
            winnerUserIds.map((userId) => ({
              user_id: userId,
              type: "team_match_win",
              title: "Vitória da equipe",
              message: `Sua equipe ${winnerTeam.name} venceu uma partida em ${event.title}.`,
              data: { event_id: event.id, match_id: match.id, team_id: winnerTeam.id },
            })),
          );
        }

        const { count: unfinishedCount } = await supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id)
          .in("status", ["pending", "in_progress"]);

        if ((unfinishedCount ?? 0) === 0 && winnerUserIds.length > 0) {
          await insertNotifications(
            supabase,
            winnerUserIds.map((userId) => ({
              user_id: userId,
              type: "team_tournament_win",
              title: "Campeões do torneio",
              message: `Parabéns! Sua equipe ${winnerTeam.name} venceu o torneio ${event.title}.`,
              data: { event_id: event.id, team_id: winnerTeam.id },
            })),
          );
        }
      }
    }

    await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "match_result_published",
      data: {
        eventTitle: event.title,
        teamA: teamA?.name ?? match.team_a_id,
        teamB: teamB?.name ?? match.team_b_id,
        scoreA: parsedInt(match.score_a),
        scoreB: parsedInt(match.score_b),
        winner: winnerName ?? "Empate",
      },
    });

    revalidateMatchPaths(event.id, match.id);
    return { success: winner ? "Vencedor definido e avançado no chaveamento." : "Partida finalizada como empate." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao definir vencedor." };
  }
}

export async function cancelMatch(matchId: string, reason: string, _adminId?: string): Promise<ActionResult> {
  const parsed = cancelMatchSchema.safeParse({ matchId, reason });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "cancel_match");
    const { match, event } = await getMatchOrThrow(supabase, parsed.data.matchId);

    const previous = { status: match.status, cancel_reason: match.cancel_reason };
    const next = { status: "cancelled", cancel_reason: parsed.data.reason };

    const { error } = await supabase
      .from("matches")
      .update({
        status: "cancelled",
        cancel_reason: parsed.data.reason,
        winner_id: null,
        ended_at: nowIso(),
        updated_at: nowIso(),
        updated_by: adminId,
      })
      .eq("id", match.id);

    if (error) return { error: "Não foi possível cancelar a partida." };

    await writeMatchLog(supabase, {
      matchId: match.id,
      eventId: match.event_id,
      adminId,
      action: "cancel_match",
      note: parsed.data.reason,
      previousState: previous,
      nextState: next,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "cancel_match",
      targetType: "match",
      targetId: match.id,
      details: { eventId: match.event_id, reason: parsed.data.reason },
    });

    revalidateMatchPaths(event.id, match.id);
    return { success: "Partida cancelada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao cancelar partida." };
  }
}

export async function generateBracket(
  eventId: string,
  format: "single_elimination" | "double_elimination" | "round_robin",
  _adminId?: string,
): Promise<ActionResult> {
  const parsed = generateBracketSchema.safeParse({ eventId, format });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "generate_bracket");
    const event = await assertEventEditable(supabase, parsed.data.eventId);

    const { data: approvedRows } = await supabase
      .from("registrations")
      .select("team_id")
      .eq("event_id", parsed.data.eventId)
      .eq("status", "approved");

    const teamIds = [...new Set((approvedRows ?? []).map((row) => String(row.team_id)))];
    if (teamIds.length < 2) {
      return { error: "São necessárias ao menos 2 equipes aprovadas para gerar o chaveamento." };
    }

    const order = await getSeededTeamOrder(supabase, event, teamIds);

    await supabase.from("matches").delete().eq("event_id", parsed.data.eventId);

    if (parsed.data.format === "round_robin") {
      const insertRows: Array<Record<string, unknown>> = [];
      const participants: Array<string | null> = [...order];
      if (participants.length % 2 !== 0) {
        participants.push(null);
      }

      const totalRounds = participants.length - 1;
      const matchesPerRound = participants.length / 2;
      let rotating = [...participants];

      for (let round = 1; round <= totalRounds; round += 1) {
        let matchIndex = 1;
        for (let index = 0; index < matchesPerRound; index += 1) {
          const teamA = rotating[index];
          const teamB = rotating[rotating.length - 1 - index];

          // Rodadas com número ímpar de equipes geram um "bye" por rodada.
          if (!teamA || !teamB) continue;

          insertRows.push({
            event_id: parsed.data.eventId,
            team_a_id: teamA,
            team_b_id: teamB,
            round,
            bracket_position: `R${round}-M${matchIndex}`,
            status: "pending",
            scheduled_at: null,
            updated_at: nowIso(),
            updated_by: adminId,
          });
          matchIndex += 1;
        }

        const fixed = rotating[0];
        const movable = rotating.slice(1);
        const last = movable.pop();
        if (last !== undefined) {
          movable.unshift(last);
          rotating = [fixed, ...movable];
        }
      }

      await supabase.from("matches").insert(insertRows);
    } else {
      const bracketSize = nextPowerOfTwo(order.length);
      const totalRounds = Math.log2(bracketSize);
      const slots = [...order];
      while (slots.length < bracketSize) slots.push(null as unknown as string);

      const rows: Array<{
        event_id: string;
        team_a_id: string | null;
        team_b_id: string | null;
        winner_id: string | null;
        score_a: number;
        score_b: number;
        round: number;
        bracket_position: string;
        status: "pending" | "finished";
        updated_at: string;
        updated_by: string;
      }> = [];

      for (let round = 1; round <= totalRounds; round += 1) {
        const matchCount = bracketSize / 2 ** round;
        for (let index = 0; index < matchCount; index += 1) {
          if (round === 1) {
            const teamA = slots[index * 2] ?? null;
            const teamB = slots[index * 2 + 1] ?? null;
            const byeWinner = teamA && !teamB ? teamA : !teamA && teamB ? teamB : null;
            rows.push({
              event_id: parsed.data.eventId,
              team_a_id: teamA,
              team_b_id: teamB,
              winner_id: byeWinner,
              score_a: byeWinner && teamA ? 1 : 0,
              score_b: byeWinner && teamB ? 1 : 0,
              round,
              bracket_position: `R${round}-M${index + 1}`,
              status: byeWinner ? "finished" : "pending",
              updated_at: nowIso(),
              updated_by: adminId,
            });
          } else {
            rows.push({
              event_id: parsed.data.eventId,
              team_a_id: null,
              team_b_id: null,
              winner_id: null,
              score_a: 0,
              score_b: 0,
              round,
              bracket_position: `R${round}-M${index + 1}`,
              status: "pending",
              updated_at: nowIso(),
              updated_by: adminId,
            });
          }
        }
      }

      const { data: inserted } = await supabase
        .from("matches")
        .insert(rows)
        .select("id, round, bracket_position, winner_id, next_match_id, next_slot");

      const byRound = new Map<number, Array<{ id: string; round: number; bracket_position: string }>>();
      for (const row of inserted ?? []) {
        const list = byRound.get(Number(row.round)) ?? [];
        list.push({ id: String(row.id), round: Number(row.round), bracket_position: String(row.bracket_position) });
        byRound.set(Number(row.round), list);
      }

      for (const [round, matches] of byRound.entries()) {
        if (round >= totalRounds) continue;
        const current = [...matches].sort((a, b) => a.bracket_position.localeCompare(b.bracket_position, "en"));
        const next = [...(byRound.get(round + 1) ?? [])].sort((a, b) => a.bracket_position.localeCompare(b.bracket_position, "en"));

        for (let index = 0; index < current.length; index += 1) {
          const nextMatch = next[Math.floor(index / 2)];
          if (!nextMatch) continue;
          const slot = index % 2 === 0 ? "team_a" : "team_b";
          await supabase
            .from("matches")
            .update({ next_match_id: nextMatch.id, next_slot: slot, updated_at: nowIso(), updated_by: adminId })
            .eq("id", current[index].id);
        }
      }

      const { data: finishedByes } = await supabase
        .from("matches")
        .select("*")
        .eq("event_id", parsed.data.eventId)
        .eq("round", 1)
        .eq("status", "finished")
        .not("winner_id", "is", null);

      for (const match of (finishedByes ?? []) as MatchRow[]) {
        if (match.winner_id) {
          await pushWinnerToNextMatch(supabase, match, match.winner_id);
        }
      }
    }

    await logAdminAction(supabase, {
      adminId,
      action: "generate_bracket",
      targetType: "event",
      targetId: parsed.data.eventId,
      details: { format: parsed.data.format, teams: teamIds.length },
    });

    revalidateMatchPaths(parsed.data.eventId);
    return {
      success:
        parsed.data.format === "double_elimination"
          ? "Bracket base gerado em modo single (fallback para double elimination)."
          : "Chaveamento gerado com sucesso.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao gerar chaveamento." };
  }
}

export async function advanceWinner(matchId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = advanceWinnerSchema.safeParse({ matchId });
  if (!parsed.success) return { error: "Partida inválida." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "advance_winner");
    const { match, event } = await getMatchOrThrow(supabase, parsed.data.matchId);

    if (match.status !== "finished") return { error: "A partida precisa estar finalizada para avançar vencedor." };
    if (!match.winner_id) return { error: "A partida finalizada sem vencedor não pode avançar no bracket." };
    if (!match.next_match_id || !match.next_slot) return { error: "Partida sem próximo confronto vinculado." };

    await pushWinnerToNextMatch(supabase, match, match.winner_id);

    await writeMatchLog(supabase, {
      matchId: match.id,
      eventId: match.event_id,
      adminId,
      action: "advance_winner",
      nextState: { next_match_id: match.next_match_id, next_slot: match.next_slot, winner_id: match.winner_id },
    });

    await logAdminAction(supabase, {
      adminId,
      action: "advance_winner",
      targetType: "match",
      targetId: match.id,
      details: { eventId: match.event_id, nextMatchId: match.next_match_id, nextSlot: match.next_slot },
    });

    revalidateMatchPaths(event.id, match.id);
    return { success: "Vencedor avançado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao avançar vencedor." };
  }
}

export async function updateMatchDetails(input: {
  matchId: string;
  status?: "pending" | "in_progress" | "finished" | "cancelled";
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes?: number | null;
  evidence?: Array<{ type: "image" | "link"; url: string; label?: string }>;
  cancel_reason?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  const parsed = updateDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "update_match_details");
    const { match, event } = await getMatchOrThrow(supabase, parsed.data.matchId);

    if (parsed.data.status === "finished") {
      const hasScore = match.score_a !== 0 || match.score_b !== 0;
      if (!hasScore) return { error: "Partidas só podem ser finalizadas se tiverem placar." };
    }

    const next = {
      status: parsed.data.status ?? match.status,
      scheduled_at: isoOrNull(parsed.data.scheduled_at) ?? match.scheduled_at,
      started_at: isoOrNull(parsed.data.started_at) ?? match.started_at,
      ended_at: isoOrNull(parsed.data.ended_at) ?? match.ended_at,
      duration_minutes:
        parsed.data.duration_minutes === undefined
          ? match.duration_minutes
          : parsed.data.duration_minutes,
      evidence: parsed.data.evidence ?? match.evidence,
      cancel_reason:
        parsed.data.cancel_reason === undefined
          ? match.cancel_reason
          : parsed.data.cancel_reason,
      updated_at: nowIso(),
      updated_by: adminId,
    };

    const { error } = await supabase.from("matches").update(next).eq("id", match.id);
    if (error) return { error: "Não foi possível atualizar os detalhes da partida." };

    await writeMatchLog(supabase, {
      matchId: match.id,
      eventId: match.event_id,
      adminId,
      action: "update_match_details",
      note: parsed.data.note ?? null,
      previousState: {
        status: match.status,
        scheduled_at: match.scheduled_at,
        started_at: match.started_at,
        ended_at: match.ended_at,
        duration_minutes: match.duration_minutes,
        evidence: match.evidence,
        cancel_reason: match.cancel_reason,
      },
      nextState: next,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "update_match_details",
      targetType: "match",
      targetId: match.id,
      details: { eventId: match.event_id, status: next.status },
    });

    if (next.status === "finished") {
      await recalculateRankings(supabase);
      const [{ data: teamA }, { data: teamB }] = await Promise.all([
        match.team_a_id ? supabase.from("teams").select("name").eq("id", match.team_a_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
        match.team_b_id ? supabase.from("teams").select("name").eq("id", match.team_b_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
      ]);
      await queueOrSendDiscordNotification({
        supabase,
        createdBy: adminId,
        type: "match_result_published",
        data: {
          eventTitle: event.title,
          teamA: teamA?.name ?? "Equipe A",
          teamB: teamB?.name ?? "Equipe B",
          scoreA: match.score_a,
          scoreB: match.score_b,
          winner: match.winner_id ?? "Empate",
        },
      });
    }

    if (parsed.data.scheduled_at && parsed.data.scheduled_at !== match.scheduled_at) {
      const [{ data: teamA }, { data: teamB }] = await Promise.all([
        match.team_a_id ? supabase.from("teams").select("name").eq("id", match.team_a_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
        match.team_b_id ? supabase.from("teams").select("name").eq("id", match.team_b_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
      ]);
      await queueOrSendDiscordNotification({
        supabase,
        createdBy: adminId,
        type: "match_scheduled",
        data: {
          eventTitle: event.title,
          teamA: teamA?.name ?? "Equipe A",
          teamB: teamB?.name ?? "Equipe B",
          scheduledAt: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(parsed.data.scheduled_at)),
        },
      });
    }

    revalidateMatchPaths(event.id, match.id);
    return { success: "Detalhes da partida atualizados." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar detalhes." };
  }
}

export async function reopenMatch(matchId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = reopenMatchSchema.safeParse({ matchId });
  if (!parsed.success) return { error: "Partida inválida." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "reopen_match");
    const { match, event } = await getMatchOrThrow(supabase, parsed.data.matchId);

    const previous = {
      status: match.status,
      winner_id: match.winner_id,
      ended_at: match.ended_at,
      cancel_reason: match.cancel_reason,
    };

    const { error } = await supabase
      .from("matches")
      .update({
        status: "pending",
        winner_id: null,
        ended_at: null,
        cancel_reason: null,
        updated_at: nowIso(),
        updated_by: adminId,
      })
      .eq("id", match.id);

    if (error) return { error: "Não foi possível reabrir a partida." };

    await writeMatchLog(supabase, {
      matchId: match.id,
      eventId: match.event_id,
      adminId,
      action: "reopen_match",
      previousState: previous,
      nextState: { status: "pending", winner_id: null, ended_at: null, cancel_reason: null },
    });

    await logAdminAction(supabase, {
      adminId,
      action: "reopen_match",
      targetType: "match",
      targetId: match.id,
      details: { eventId: match.event_id },
    });

    await recalculateRankings(supabase);
    revalidateMatchPaths(event.id, match.id);
    return { success: "Partida reaberta com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao reabrir partida." };
  }
}

export async function revertMatchResult(matchId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = revertSchema.safeParse({ matchId });
  if (!parsed.success) return { error: "Partida inválida." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "revert_match_result");
    const { match, event } = await getMatchOrThrow(supabase, parsed.data.matchId);

    const { data: lastLog } = await supabase
      .from("match_result_logs")
      .select("id, action, previous_state")
      .eq("match_id", match.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; action: string; previous_state: Record<string, unknown> | null }>();

    const previousState = lastLog?.previous_state ?? {};

    const restore = {
      score_a: Number(previousState.score_a ?? 0),
      score_b: Number(previousState.score_b ?? 0),
      winner_id: (previousState.winner_id as string | null | undefined) ?? null,
      status: (previousState.status as MatchRow["status"] | undefined) ?? "pending",
      started_at: (previousState.started_at as string | null | undefined) ?? null,
      ended_at: (previousState.ended_at as string | null | undefined) ?? null,
      duration_minutes: (previousState.duration_minutes as number | null | undefined) ?? null,
      cancel_reason: (previousState.cancel_reason as string | null | undefined) ?? null,
      updated_at: nowIso(),
      updated_by: adminId,
    };

    const { error } = await supabase.from("matches").update(restore).eq("id", match.id);
    if (error) return { error: "Não foi possível reverter o resultado." };

    if (match.next_match_id && match.winner_id) {
      const slotNullPayload = match.next_slot === "team_a" ? { team_a_id: null } : { team_b_id: null };
      await supabase.from("matches").update({ ...slotNullPayload, updated_at: nowIso(), updated_by: adminId }).eq("id", match.next_match_id);
    }

    await recalculateRankings(supabase);

    await writeMatchLog(supabase, {
      matchId: match.id,
      eventId: match.event_id,
      adminId,
      action: "revert_match_result",
      note: `Revertido a partir de ${lastLog?.action ?? "estado padrão"}`,
      previousState: {
        score_a: match.score_a,
        score_b: match.score_b,
        winner_id: match.winner_id,
        status: match.status,
      },
      nextState: restore,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "revert_match_result",
      targetType: "match",
      targetId: match.id,
      details: { eventId: match.event_id, sourceAction: lastLog?.action ?? null },
    });

    revalidateMatchPaths(event.id, match.id);
    return { success: "Resultado revertido e ranking recalculado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao reverter resultado." };
  }
}

export async function resetBracket(eventId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(eventId);
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "reset_bracket");
    await assertEventEditable(supabase, parsed.data);

    await supabase.from("matches").delete().eq("event_id", parsed.data);

    await logAdminAction(supabase, {
      adminId,
      action: "reset_bracket",
      targetType: "event",
      targetId: parsed.data,
    });

    revalidateMatchPaths(parsed.data);
    return { success: "Chaveamento resetado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao resetar chaveamento." };
  }
}

export async function reorderBracketRound(eventId: string, round: number, orderedMatchIds: string[]): Promise<ActionResult> {
  const schema = z.object({
    eventId: z.string().uuid(),
    round: z.coerce.number().int().min(1),
    orderedMatchIds: z.array(z.string().uuid()).min(1),
  });
  const parsed = schema.safeParse({ eventId, round, orderedMatchIds });
  if (!parsed.success) return { error: "Dados inválidos para reorder." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "reorder_bracket_round");
    await assertEventEditable(supabase, parsed.data.eventId);

    for (let index = 0; index < parsed.data.orderedMatchIds.length; index += 1) {
      const id = parsed.data.orderedMatchIds[index];
      await supabase
        .from("matches")
        .update({ bracket_position: `R${parsed.data.round}-M${index + 1}`, updated_at: nowIso(), updated_by: adminId })
        .eq("id", id)
        .eq("event_id", parsed.data.eventId)
        .eq("round", parsed.data.round);
    }

    await logAdminAction(supabase, {
      adminId,
      action: "reorder_bracket_round",
      targetType: "event",
      targetId: parsed.data.eventId,
      details: { round: parsed.data.round, orderedMatchIds: parsed.data.orderedMatchIds },
    });

    revalidateMatchPaths(parsed.data.eventId);
    return { success: "Posições do bracket atualizadas." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao reordenar bracket." };
  }
}

export async function recalculateAllRankings(): Promise<ActionResult> {
  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "recalculate_rankings_admin");
    await recalculateRankings(supabase);

    await logAdminAction(supabase, {
      adminId,
      action: "recalculate_rankings_admin",
      targetType: "ranking",
      details: { source: "admin_results" },
    });

    await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "ranking_updated",
      data: { source: "admin_results" },
    });

    return { success: "Ranking recalculado com base nas partidas finalizadas." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao recalcular ranking." };
  }
}

export async function calculateRankings(eventId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(eventId);
  if (!parsed.success) return { error: "Evento inválido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "calculate_rankings_event");
    await recalculateRankings(supabase);

    await logAdminAction(supabase, {
      adminId,
      action: "calculate_rankings_event",
      targetType: "event",
      targetId: parsed.data,
    });

    revalidateMatchPaths(parsed.data);
    return { success: "Ranking recalculado para o contexto do evento." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao calcular ranking." };
  }
}

function parsedInt(value: number | null | undefined) {
  return Number(value ?? 0);
}
