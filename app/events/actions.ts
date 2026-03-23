"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getRequestContext, writeSecurityAlert } from "@/lib/security/alerts";
import { createClient } from "@/lib/supabase/server";

const registerSchema = z.object({
  event_id: z.string().uuid("ID de evento inválido."),
  team_id: z.string().uuid("ID de equipe inválido."),
});

export type RegisterTeamState = {
  error?: string | null;
  success?: string | null;
};

export type UpdateMatchState = {
  error?: string | null;
  success?: string | null;
};

const updateMatchSchema = z.object({
  event_id: z.string().uuid("Evento inválido."),
  match_id: z.string().uuid("Partida inválida."),
  team_a_id: z.string().uuid("Time A inválido."),
  team_b_id: z.string().uuid("Time B inválido."),
  score_a: z.coerce.number().int().min(0, "Placar A inválido."),
  score_b: z.coerce.number().int().min(0, "Placar B inválido."),
});

const updateRankingSchema = z.object({
  match_id: z.string().uuid("Partida inválida."),
});

type RankingAccumulator = {
  points: number;
  wins: number;
  losses: number;
};

export async function registerTeamForEvent(
  _prevState: RegisterTeamState,
  formData: FormData,
): Promise<RegisterTeamState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Você precisa estar logado para inscrever uma equipe." };
  }

  const parsed = registerSchema.safeParse({
    event_id: formData.get("event_id"),
    team_id: formData.get("team_id"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { event_id, team_id } = parsed.data;

  const nowIso = new Date().toISOString();
  const { data: activeRestriction } = await supabase
    .from("bans")
    .select("id, reason, expires_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("scope", "tournament_registration")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; reason: string; expires_at: string | null }>();

  if (activeRestriction) {
    const until = activeRestriction.expires_at
      ? ` ate ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(activeRestriction.expires_at))}`
      : "";
    return { error: `Sua conta esta suspensa para inscricoes em torneios${until}. Motivo: ${activeRestriction.reason}` };
  }

  const { data: event } = await supabase
    .from("events")
    .select("status, registration_deadline, max_teams, crew_type")
    .eq("id", event_id)
    .maybeSingle<{
      status: "registrations_open" | "check_in" | "started" | "finished";
      registration_deadline: string | null;
      max_teams: number | null;
      crew_type: "solo_sloop" | "sloop" | "brig" | "galleon";
    }>();

  if (!event) {
    return { error: "Evento não encontrado." };
  }

  if (event.status !== "registrations_open" && event.status !== "check_in") {
    return { error: "Este evento não está aceitando inscrições no momento." };
  }

  if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
    return { error: "O prazo de inscrição para este evento já terminou." };
  }

  if (event.max_teams) {
    const { count } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event_id)
      .eq("status", "approved");

    if ((count ?? 0) >= event.max_teams) {
      return { error: "Todas as vagas para este torneio ja foram preenchidas." };
    }
  }

  // Garante no servidor que o usuário é capitão da equipe informada.
  const { data: team } = await supabase
    .from("teams")
    .select("captain_id")
    .eq("id", team_id)
    .single();

  if (!team || team.captain_id !== user.id) {
    return { error: "Você não é o capitão desta equipe." };
  }

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", team_id);

  const roster = new Set<string>([user.id]);
  for (const row of members ?? []) {
    roster.add(String(row.user_id));
  }

  const expectedSize = event.crew_type === "solo_sloop" ? 1 : event.crew_type === "sloop" ? 2 : event.crew_type === "brig" ? 3 : 4;
  if (roster.size !== expectedSize) {
    return { error: `Sua equipe precisa ter exatamente ${expectedSize} jogadores para este torneio.` };
  }

  const { error } = await supabase.from("registrations").insert({
    event_id,
    team_id,
    source: "self_service",
    created_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Sua equipe já está inscrita neste evento." };
    }
    return { error: "Não foi possível realizar a inscrição. Tente novamente." };
  }

  revalidatePath(`/events/${event_id}`);
  return { success: "Equipe inscrita com sucesso! Aguarde a aprovação." };
}

export async function updateMatchResult(
  _prevState: UpdateMatchState,
  formData: FormData,
): Promise<UpdateMatchState> {
  const supabase = await createClient();
  const headerStore = await headers();
  const context = getRequestContext(headerStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await writeSecurityAlert({
      action: "auth_401_update_match_result",
      targetType: "match",
      riskLevel: "high",
      context,
    });
    return { error: "Você precisa estar logado." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    await writeSecurityAlert({
      adminUserId: user.id,
      action: "auth_403_update_match_result",
      targetType: "match",
      targetId: String(formData.get("match_id") ?? ""),
      riskLevel: "critical",
      context: {
        ...context,
        role: profile?.role ?? null,
        eventId: formData.get("event_id"),
      },
    });
    return { error: "Apenas administradores podem editar partidas." };
  }

  const parsed = updateMatchSchema.safeParse({
    event_id: formData.get("event_id"),
    match_id: formData.get("match_id"),
    team_a_id: formData.get("team_a_id"),
    team_b_id: formData.get("team_b_id"),
    score_a: formData.get("score_a"),
    score_b: formData.get("score_b"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { event_id, match_id, score_a, score_b, team_a_id, team_b_id } = parsed.data;

  const winnerId = score_a === score_b ? null : score_a > score_b ? team_a_id : team_b_id;
  const isFinished = score_a !== 0 || score_b !== 0 || winnerId !== null;

  const { error: updateError } = await supabase
    .from("matches")
    .update({
      score_a,
      score_b,
      winner_id: winnerId,
    })
    .eq("id", match_id)
    .eq("event_id", event_id);

  if (updateError) {
    return { error: "Não foi possível atualizar o confronto." };
  }

  if (isFinished) {
    const rankingForm = new FormData();
    rankingForm.set("match_id", match_id);
    const rankingResult = await updateRanking(rankingForm);
    if (rankingResult.error) {
      return { error: rankingResult.error };
    }
  }

  revalidatePath(`/events/${event_id}`);
  revalidatePath(`/events/${event_id}/bracket`);
  revalidateTag("events", "max");
  revalidateTag("public-data", "max");
  revalidateTag(`event:${event_id}`, "max");
  revalidateTag(`event-bracket:${event_id}`, "max");
  revalidatePath("/ranking");

  return { success: "Confronto atualizado com sucesso." };
}

export async function updateRanking(formData: FormData): Promise<UpdateMatchState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Você precisa estar logado." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return { error: "Apenas administradores podem atualizar o ranking." };
  }

  const parsed = updateRankingSchema.safeParse({
    match_id: formData.get("match_id"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: allTeams } = await supabase.from("teams").select("id, captain_id");
  const { data: members } = await supabase.from("team_members").select("team_id, user_id");
  const [{ data: matches }, { data: events }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, event_id, team_a_id, team_b_id, winner_id, score_a, score_b"),
    supabase.from("events").select("id, scoring_win, scoring_draw, scoring_loss"),
  ]);

  const rosterByTeam = new Map<string, Set<string>>();

  for (const team of allTeams ?? []) {
    const teamId = team.id as string;
    if (!rosterByTeam.has(teamId)) {
      rosterByTeam.set(teamId, new Set<string>());
    }
    rosterByTeam.get(teamId)?.add(team.captain_id as string);
  }

  for (const member of members ?? []) {
    const teamId = member.team_id as string;
    if (!rosterByTeam.has(teamId)) {
      rosterByTeam.set(teamId, new Set<string>());
    }
    rosterByTeam.get(teamId)?.add(member.user_id as string);
  }

  const standings = new Map<string, RankingAccumulator>();
  const eventScoreMap = new Map<string, { win: number; draw: number; loss: number }>();

  for (const event of events ?? []) {
    eventScoreMap.set(String(event.id), {
      win: Number(event.scoring_win ?? 3),
      draw: Number(event.scoring_draw ?? 1),
      loss: Number(event.scoring_loss ?? 0),
    });
  }

  function applyToRoster(profileIds: Set<string>, update: (acc: RankingAccumulator) => void) {
    for (const profileId of profileIds) {
      if (!standings.has(profileId)) {
        standings.set(profileId, { points: 0, wins: 0, losses: 0 });
      }
      const current = standings.get(profileId);
      if (current) {
        update(current);
      }
    }
  }

  for (const match of matches ?? []) {
    const scoring = eventScoreMap.get(String(match.event_id)) ?? { win: 3, draw: 1, loss: 0 };
    const teamAId = match.team_a_id as string;
    const teamBId = match.team_b_id as string;
    const scoreA = Number(match.score_a ?? 0);
    const scoreB = Number(match.score_b ?? 0);
    const winnerId = (match.winner_id as string | null) ?? null;
    const isFinished = scoreA !== 0 || scoreB !== 0 || winnerId !== null;

    if (!isFinished) {
      continue;
    }

    const rosterA = rosterByTeam.get(teamAId) ?? new Set<string>();
    const rosterB = rosterByTeam.get(teamBId) ?? new Set<string>();

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

  const upsertRows = sorted.map(([profileId, stats], idx) => ({
    profile_id: profileId,
    points: stats.points,
    wins: stats.wins,
    losses: stats.losses,
    rank_position: idx + 1,
  }));

  const { error: deleteError } = await supabase.from("rankings").delete().gte("points", 0);

  if (deleteError) {
    return { error: "Não foi possível limpar o ranking para recalcular." };
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase.from("rankings").insert(upsertRows);
    if (upsertError) {
      return { error: "Não foi possível recalcular o ranking." };
    }
  }

  revalidatePath("/ranking");
  revalidatePath("/profile/me");

  return { success: "Ranking atualizado com sucesso." };
}
