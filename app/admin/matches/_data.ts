import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AdminMatchRow = {
  id: string;
  event_id: string;
  event_title: string;
  round: number;
  team_a_id: string | null;
  team_a_name: string;
  team_b_id: string | null;
  team_b_name: string;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  winner_name: string;
  status: "pending" | "in_progress" | "finished" | "cancelled";
  scheduled_at: string | null;
  updated_at: string;
  bracket_position: string | null;
};

export type MatchDetail = {
  id: string;
  event_id: string;
  event_title: string;
  event_status: string;
  round: number;
  bracket_position: string | null;
  team_a_id: string | null;
  team_a_name: string;
  team_a_logo_url: string | null;
  team_b_id: string | null;
  team_b_name: string;
  team_b_logo_url: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  status: "pending" | "in_progress" | "finished" | "cancelled";
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  evidence: Array<{ type: "image" | "link"; url: string; label?: string }>;
  cancel_reason: string | null;
  next_match_id: string | null;
  next_slot: "team_a" | "team_b" | null;
  updated_at: string;
};

export type MatchHistoryItem = {
  id: string;
  action: string;
  note: string | null;
  previous_state: Record<string, unknown> | null;
  next_state: Record<string, unknown> | null;
  created_at: string;
  admin_name: string;
};

export type BracketMatchRow = {
  id: string;
  round: number;
  bracket_position: string | null;
  status: "pending" | "in_progress" | "finished" | "cancelled";
  team_a_id: string | null;
  team_a_name: string;
  team_b_id: string | null;
  team_b_name: string;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  next_match_id: string | null;
  next_slot: "team_a" | "team_b" | null;
  updated_at: string;
};

export type ResultRow = {
  id: string;
  event_id: string;
  event_title: string;
  round: number;
  team_a_name: string;
  team_b_name: string;
  score_a: number;
  score_b: number;
  winner_name: string;
  ended_at: string | null;
  updated_at: string;
};

async function getEventMap(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("events").select("id, title, status");
  const map = new Map<string, { title: string; status: string }>();
  for (const row of data ?? []) {
    map.set(String(row.id), { title: String(row.title), status: String(row.status) });
  }
  return map;
}

async function getTeamNameMap(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("teams").select("id, name, logo_url");
  const map = new Map<string, { name: string; logoUrl: string | null }>();
  for (const row of data ?? []) {
    map.set(String(row.id), {
      name: String(row.name),
      logoUrl: (row.logo_url as string | null) ?? null,
    });
  }
  return map;
}

export async function getAdminMatches() {
  const supabase = await createClient();
  const [{ data: matchesRaw }, eventMap, teamMap] = await Promise.all([
    supabase
      .from("matches")
      .select("id, event_id, round, team_a_id, team_b_id, winner_id, score_a, score_b, status, scheduled_at, updated_at, bracket_position")
      .order("updated_at", { ascending: false }),
    getEventMap(supabase),
    getTeamNameMap(supabase),
  ]);

  return ((matchesRaw ?? []) as Array<Record<string, unknown>>).map((row) => {
    const eventId = String(row.event_id);
    const teamAId = row.team_a_id ? String(row.team_a_id) : null;
    const teamBId = row.team_b_id ? String(row.team_b_id) : null;
    const winnerId = row.winner_id ? String(row.winner_id) : null;

    return {
      id: String(row.id),
      event_id: eventId,
      event_title: eventMap.get(eventId)?.title ?? "Evento removido",
      round: Number(row.round ?? 1),
      team_a_id: teamAId,
      team_a_name: teamAId ? teamMap.get(teamAId)?.name ?? "Equipe removida" : "A definir",
      team_b_id: teamBId,
      team_b_name: teamBId ? teamMap.get(teamBId)?.name ?? "Equipe removida" : "A definir",
      score_a: Number(row.score_a ?? 0),
      score_b: Number(row.score_b ?? 0),
      winner_id: winnerId,
      winner_name: winnerId ? teamMap.get(winnerId)?.name ?? "Equipe removida" : "-",
      status: (row.status as AdminMatchRow["status"]) ?? "pending",
      scheduled_at: (row.scheduled_at as string | null) ?? null,
      updated_at: String(row.updated_at),
      bracket_position: (row.bracket_position as string | null) ?? null,
    } satisfies AdminMatchRow;
  });
}

export async function getMatchDetail(matchId: string) {
  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle<Record<string, unknown>>();
  if (!match) notFound();

  const [eventMap, teamMap] = await Promise.all([getEventMap(supabase), getTeamNameMap(supabase)]);
  const event = eventMap.get(String(match.event_id));
  if (!event) notFound();

  const { data: logsRaw } = await supabase
    .from("match_result_logs")
    .select("id, action, note, previous_state, next_state, created_at, admin_user_id")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(80);

  const adminIds = [...new Set((logsRaw ?? []).map((log) => String(log.admin_user_id)))];
  const { data: adminsRaw } = adminIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, username").in("id", adminIds)
    : { data: [] };

  const adminNameMap = new Map<string, string>();
  for (const admin of adminsRaw ?? []) {
    adminNameMap.set(String(admin.id), String(admin.display_name ?? admin.username ?? "Admin"));
  }

  const detail: MatchDetail = {
    id: String(match.id),
    event_id: String(match.event_id),
    event_title: event.title,
    event_status: event.status,
    round: Number(match.round ?? 1),
    bracket_position: (match.bracket_position as string | null) ?? null,
    team_a_id: (match.team_a_id as string | null) ?? null,
    team_a_name: match.team_a_id ? teamMap.get(String(match.team_a_id))?.name ?? "Equipe removida" : "A definir",
    team_a_logo_url: match.team_a_id ? teamMap.get(String(match.team_a_id))?.logoUrl ?? null : null,
    team_b_id: (match.team_b_id as string | null) ?? null,
    team_b_name: match.team_b_id ? teamMap.get(String(match.team_b_id))?.name ?? "Equipe removida" : "A definir",
    team_b_logo_url: match.team_b_id ? teamMap.get(String(match.team_b_id))?.logoUrl ?? null : null,
    score_a: Number(match.score_a ?? 0),
    score_b: Number(match.score_b ?? 0),
    winner_id: (match.winner_id as string | null) ?? null,
    status: (match.status as MatchDetail["status"]) ?? "pending",
    scheduled_at: (match.scheduled_at as string | null) ?? null,
    started_at: (match.started_at as string | null) ?? null,
    ended_at: (match.ended_at as string | null) ?? null,
    duration_minutes: (match.duration_minutes as number | null) ?? null,
    evidence: (match.evidence as MatchDetail["evidence"]) ?? [],
    cancel_reason: (match.cancel_reason as string | null) ?? null,
    next_match_id: (match.next_match_id as string | null) ?? null,
    next_slot: (match.next_slot as MatchDetail["next_slot"]) ?? null,
    updated_at: String(match.updated_at),
  };

  const history: MatchHistoryItem[] = (logsRaw ?? []).map((row) => ({
    id: String(row.id),
    action: String(row.action),
    note: (row.note as string | null) ?? null,
    previous_state: (row.previous_state as Record<string, unknown> | null) ?? null,
    next_state: (row.next_state as Record<string, unknown> | null) ?? null,
    created_at: String(row.created_at),
    admin_name: adminNameMap.get(String(row.admin_user_id)) ?? "Admin",
  }));

  return { detail, history };
}

export async function getTournamentBracketData(eventId: string) {
  const supabase = await createClient();
  const [{ data: matchesRaw }, eventMap, teamMap] = await Promise.all([
    supabase
      .from("matches")
      .select("id, round, bracket_position, status, team_a_id, team_b_id, score_a, score_b, winner_id, next_match_id, next_slot, updated_at")
      .eq("event_id", eventId)
      .order("round", { ascending: true })
      .order("bracket_position", { ascending: true }),
    getEventMap(supabase),
    getTeamNameMap(supabase),
  ]);

  const event = eventMap.get(eventId);
  if (!event) notFound();

  const matches: BracketMatchRow[] = (matchesRaw ?? []).map((row) => {
    const teamAId = row.team_a_id ? String(row.team_a_id) : null;
    const teamBId = row.team_b_id ? String(row.team_b_id) : null;
    const winnerId = row.winner_id ? String(row.winner_id) : null;

    return {
      id: String(row.id),
      round: Number(row.round ?? 1),
      bracket_position: (row.bracket_position as string | null) ?? null,
      status: (row.status as BracketMatchRow["status"]) ?? "pending",
      team_a_id: teamAId,
      team_a_name: teamAId ? teamMap.get(teamAId)?.name ?? "Equipe removida" : "A definir",
      team_b_id: teamBId,
      team_b_name: teamBId ? teamMap.get(teamBId)?.name ?? "Equipe removida" : "A definir",
      score_a: Number(row.score_a ?? 0),
      score_b: Number(row.score_b ?? 0),
      winner_id: winnerId,
      next_match_id: (row.next_match_id as string | null) ?? null,
      next_slot: (row.next_slot as BracketMatchRow["next_slot"]) ?? null,
      updated_at: String(row.updated_at),
    };
  });

  return {
    event: {
      id: eventId,
      title: event.title,
      status: event.status,
    },
    matches,
  };
}

export async function getResultsData() {
  const supabase = await createClient();
  const [{ data: matchesRaw }, eventMap, teamMap] = await Promise.all([
    supabase
      .from("matches")
      .select("id, event_id, round, team_a_id, team_b_id, score_a, score_b, winner_id, ended_at, updated_at, status")
      .eq("status", "finished")
      .order("ended_at", { ascending: false }),
    getEventMap(supabase),
    getTeamNameMap(supabase),
  ]);

  const rows: ResultRow[] = (matchesRaw ?? []).map((row) => {
    const teamAId = row.team_a_id ? String(row.team_a_id) : null;
    const teamBId = row.team_b_id ? String(row.team_b_id) : null;
    const winnerId = row.winner_id ? String(row.winner_id) : null;

    return {
      id: String(row.id),
      event_id: String(row.event_id),
      event_title: eventMap.get(String(row.event_id))?.title ?? "Evento removido",
      round: Number(row.round ?? 1),
      team_a_name: teamAId ? teamMap.get(teamAId)?.name ?? "Equipe removida" : "A definir",
      team_b_name: teamBId ? teamMap.get(teamBId)?.name ?? "Equipe removida" : "A definir",
      score_a: Number(row.score_a ?? 0),
      score_b: Number(row.score_b ?? 0),
      winner_name: winnerId ? teamMap.get(winnerId)?.name ?? "Equipe removida" : "Empate",
      ended_at: (row.ended_at as string | null) ?? null,
      updated_at: String(row.updated_at),
    };
  });

  return rows;
}
