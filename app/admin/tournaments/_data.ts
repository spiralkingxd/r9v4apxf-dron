import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AdminEventListRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "active" | "paused" | "finished";
  event_kind: "event" | "tournament";
  event_type: "tournament" | "special" | "scrimmage";
  visibility: "public" | "private";
  start_date: string;
  end_date: string | null;
  team_size: number;
  prize_description: string | null;
  created_at: string;
  tournament_format: string | null;
  approved_registrations: number;
  pending_registrations: number;
};

export type EventFormRow = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  registration_deadline: string | null;
  event_kind: "event" | "tournament";
  event_type: "tournament" | "special" | "scrimmage";
  visibility: "public" | "private";
  team_size: number;
  prize_description: string | null;
  rules: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: "draft" | "published" | "active" | "paused" | "finished";
  scoring_win: number;
  scoring_loss: number;
  scoring_draw: number;
  tournament_format: "single_elimination" | "double_elimination" | "round_robin" | null;
  rounds_count: number | null;
  seeding_method: "random" | "manual" | "ranking" | null;
  max_teams: number | null;
};

export type RegistrationRow = {
  team_id: string;
  team_name: string;
  captain_name: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  source: "self_service" | "wildcard";
  created_at: string;
  rejection_reason: string | null;
};

export type AvailableTeamRow = {
  id: string;
  name: string;
  captain_name: string;
};

export async function getAdminEvents() {
  const supabase = await createClient();
  const [{ data: eventsRaw }, { data: registrationsRaw }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, status, event_kind, event_type, visibility, start_date, end_date, team_size, prize_description, created_at, tournament_format")
      .eq("event_kind", "tournament")
      .order("start_date", { ascending: false }),
    supabase.from("registrations").select("event_id, status"),
  ]);

  const countByEvent = new Map<string, { approved: number; pending: number }>();
  for (const row of registrationsRaw ?? []) {
    const eventId = String(row.event_id);
    const current = countByEvent.get(eventId) ?? { approved: 0, pending: 0 };
    if (row.status === "approved") current.approved += 1;
    if (row.status === "pending") current.pending += 1;
    countByEvent.set(eventId, current);
  }

  return ((eventsRaw ?? []) as Omit<AdminEventListRow, "approved_registrations" | "pending_registrations">[]).map((row) => {
    const counters = countByEvent.get(row.id) ?? { approved: 0, pending: 0 };
    return {
      ...row,
      approved_registrations: counters.approved,
      pending_registrations: counters.pending,
    };
  });
}

export async function getEventForForm(eventId: string, expectedKind?: "event" | "tournament") {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle<EventFormRow>();
  if (!data) notFound();
  if (expectedKind && data.event_kind !== expectedKind) notFound();
  return data;
}

export async function getEventRegistrations(eventId: string, expectedKind?: "event" | "tournament") {
  const supabase = await createClient();
  const [{ data: event }, { data: registrationsRaw }, { data: teamsRaw }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, status, event_kind, event_type, visibility, start_date, registration_deadline, max_teams")
      .eq("id", eventId)
      .maybeSingle<{
        id: string;
        title: string;
        status: string;
        event_kind: string;
        event_type: string;
        visibility: string;
        start_date: string;
        registration_deadline: string | null;
        max_teams: number | null;
      }>(),
    supabase
      .from("registrations")
      .select("team_id, status, source, created_at, rejection_reason")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase.from("teams").select("id, name, captain_id"),
  ]);

  if (!event) notFound();
  if (expectedKind && event.event_kind !== expectedKind) notFound();

  const captainIds = (teamsRaw ?? []).map((row) => String(row.captain_id));
  const uniqueCaptainIds = [...new Set(captainIds)];
  const { data: profilesRaw } = uniqueCaptainIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, username").in("id", uniqueCaptainIds)
    : { data: [] };

  const captainNameById = new Map<string, string>();
  for (const profile of profilesRaw ?? []) {
    captainNameById.set(String(profile.id), String(profile.display_name ?? profile.username ?? "Usuário"));
  }

  const teamById = new Map<string, { name: string; captain_id: string }>();
  for (const team of teamsRaw ?? []) {
    teamById.set(String(team.id), { name: String(team.name), captain_id: String(team.captain_id) });
  }

  const registrations: RegistrationRow[] = (registrationsRaw ?? []).map((row) => {
    const team = teamById.get(String(row.team_id));
    return {
      team_id: String(row.team_id),
      team_name: team?.name ?? "Equipe removida",
      captain_name: captainNameById.get(team?.captain_id ?? "") ?? "Capitão indisponível",
      status: row.status as RegistrationRow["status"],
      source: row.source as RegistrationRow["source"],
      created_at: String(row.created_at),
      rejection_reason: (row.rejection_reason as string | null) ?? null,
    };
  });

  const registeredTeamIds = new Set(registrations.map((row) => row.team_id));
  const availableTeams: AvailableTeamRow[] = (teamsRaw ?? [])
    .filter((team) => !registeredTeamIds.has(String(team.id)))
    .map((team) => ({
      id: String(team.id),
      name: String(team.name),
      captain_name: captainNameById.get(String(team.captain_id)) ?? "Capitão indisponível",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return {
    event,
    registrations,
    availableTeams,
  };
}

export async function getAdminEventDetail(eventId: string, expectedKind?: "event" | "tournament") {
  const supabase = await createClient();

  const [eventRes, registrationsRes, matchesRes, logsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, status, event_kind, event_type, visibility, start_date, end_date, registration_deadline, team_size, tournament_format, max_teams, created_at, updated_at")
      .eq("id", eventId)
      .maybeSingle<{
        id: string;
        title: string;
        description: string | null;
        status: "draft" | "published" | "active" | "paused" | "finished";
        event_kind: "event" | "tournament";
        event_type: "tournament" | "special" | "scrimmage";
        visibility: "public" | "private";
        start_date: string;
        end_date: string | null;
        registration_deadline: string | null;
        team_size: number;
        tournament_format: string | null;
        max_teams: number | null;
        created_at: string;
        updated_at: string;
      }>(),
    supabase.from("registrations").select("status").eq("event_id", eventId),
    supabase
      .from("matches")
      .select("id, status, round, team_a_id, team_b_id, score_a, score_b, winner_id, updated_at")
      .eq("event_id", eventId)
      .order("round", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("admin_action_logs")
      .select("id, action, details, created_at, admin_user_id")
      .eq("target_type", "event")
      .eq("target_id", eventId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const event = eventRes.data;
  if (!event) notFound();
  if (expectedKind && event.event_kind !== expectedKind) notFound();

  const registrations = registrationsRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const logsRaw = logsRes.data ?? [];

  const teamIds = [...new Set(matches.flatMap((row) => [row.team_a_id, row.team_b_id, row.winner_id]).filter(Boolean).map(String))];
  const { data: teamsRaw } = teamIds.length > 0
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };
  const teamNameById = new Map<string, string>();
  for (const team of teamsRaw ?? []) {
    teamNameById.set(String(team.id), String(team.name));
  }

  const adminIds = [...new Set(logsRaw.map((log) => String(log.admin_user_id)).filter(Boolean))];
  const { data: adminsRaw } = adminIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, username").in("id", adminIds)
    : { data: [] };

  const adminNameById = new Map<string, string>();
  for (const admin of adminsRaw ?? []) {
    adminNameById.set(String(admin.id), String(admin.display_name ?? admin.username ?? "Admin"));
  }

  return {
    event,
    counts: {
      registrationsTotal: registrations.length,
      registrationsApproved: registrations.filter((row) => row.status === "approved").length,
      registrationsPending: registrations.filter((row) => row.status === "pending").length,
      registrationsRejected: registrations.filter((row) => row.status === "rejected").length,
      matchesTotal: matches.length,
      matchesFinished: matches.filter((row) => row.status === "finished").length,
    },
    matches: matches.map((row) => ({
      id: String(row.id),
      status: String(row.status),
      round: Number(row.round ?? 1),
      score_a: Number(row.score_a ?? 0),
      score_b: Number(row.score_b ?? 0),
      team_a_id: row.team_a_id ? String(row.team_a_id) : null,
      team_b_id: row.team_b_id ? String(row.team_b_id) : null,
      winner_id: row.winner_id ? String(row.winner_id) : null,
      team_a_name: row.team_a_id ? teamNameById.get(String(row.team_a_id)) ?? "Equipe removida" : "A definir",
      team_b_name: row.team_b_id ? teamNameById.get(String(row.team_b_id)) ?? "Equipe removida" : "A definir",
      winner_name: row.winner_id ? teamNameById.get(String(row.winner_id)) ?? "Equipe removida" : "-",
      updated_at: String(row.updated_at),
    })),
    logs: logsRaw.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      details: (row.details as Record<string, unknown> | null) ?? null,
      created_at: String(row.created_at),
      admin_name: adminNameById.get(String(row.admin_user_id)) ?? "Admin",
    })),
  };
}
