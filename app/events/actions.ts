"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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

const POINTS_CONFIG = {
  win: Number(process.env.MATCH_POINTS_WIN ?? 3),
  draw: Number(process.env.MATCH_POINTS_DRAW ?? 1),
  loss: Number(process.env.MATCH_POINTS_LOSS ?? 0),
};

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

  // Garante no servidor que o usuário é capitão da equipe informada.
  const { data: team } = await supabase
    .from("teams")
    .select("captain_id")
    .eq("id", team_id)
    .single();

  if (!team || team.captain_id !== user.id) {
    return { error: "Você não é o capitão desta equipe." };
  }

  const { error } = await supabase.from("registrations").insert({ event_id, team_id });

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Você precisa estar logado." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "admin") {
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

  if (profile?.role !== "admin") {
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
  const { data: matches } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, winner_id, score_a, score_b");

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
        acc.points += POINTS_CONFIG.draw;
      });
      applyToRoster(rosterB, (acc) => {
        acc.points += POINTS_CONFIG.draw;
      });
      continue;
    }

    const winnerTeamId = winnerId ?? (scoreA > scoreB ? teamAId : teamBId);
    const loserTeamId = winnerTeamId === teamAId ? teamBId : teamAId;
    const winnerRoster = winnerTeamId === teamAId ? rosterA : rosterB;
    const loserRoster = loserTeamId === teamAId ? rosterA : rosterB;

    applyToRoster(winnerRoster, (acc) => {
      acc.points += POINTS_CONFIG.win;
      acc.wins += 1;
    });

    applyToRoster(loserRoster, (acc) => {
      acc.points += POINTS_CONFIG.loss;
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
