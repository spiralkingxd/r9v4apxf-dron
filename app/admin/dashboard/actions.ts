"use server";

import { assertAdminAccess } from "@/app/admin/_lib";

type DashboardStat = {
  totalUsers: number;
  activeUsers30d: number;
  totalTeams: number;
  activeTeams: number;
  totalTournaments: number;
  activeTournaments: number;
  matchesToday: number;
  totalRevenue: number;
};

type LinePoint = {
  label: string;
  total: number;
};

type PiePoint = {
  name: string;
  value: number;
};

export type DashboardStatsPayload = {
  stats: DashboardStat;
  charts: {
    registrations30d: LinePoint[];
    usersByMonth: LinePoint[];
    teamsByMonth: LinePoint[];
    tournamentStatus: PiePoint[];
  };
};

export type DashboardActivityPayload = {
  latestLogins: Array<{ title: string; createdAt: string }>;
  latestTeams: Array<{ title: string; createdAt: string }>;
  latestPublishedTournaments: Array<{ title: string; createdAt: string }>;
  latestAdminActions: Array<{ title: string; createdAt: string }>;
};

export type DashboardAlertsPayload = {
  lowMemberTeams: Array<{ id: string; name: string; members: number }>;
  upcomingTournaments24h: Array<{ id: string; title: string; startDate: string }>;
  staleMatches48h: Array<{ id: string; eventId: string; scheduledAt: string }>;
  usersWithMultiplePendingRequests: Array<{ userId: string; name: string; pendingRequests: number }>;
};

type ExportType = "overview" | "users" | "teams" | "events" | "registrations";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  return `${head}\n${body}`;
}

export async function getDashboardStats(): Promise<DashboardStatsPayload> {
  const { supabase } = await assertAdminAccess();

  const now = new Date();
  const cutoff30d = new Date(now);
  cutoff30d.setDate(now.getDate() - 30);

  const usersMonths = 6;
  const usersCutoff = new Date(now.getFullYear(), now.getMonth() - (usersMonths - 1), 1);

  const [
    { count: totalUsers },
    { count: activeUsers30d },
    { count: totalTeams },
    teamMembersRes,
    { count: totalTournaments },
    { count: activeTournaments },
    { count: matchesToday },
    eventsPrizeRes,
    registrationsRes,
    usersCreatedRes,
    teamsCreatedRes,
    eventsStatusRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("updated_at", cutoff30d.toISOString()),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("team_members").select("team_id"),
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", startOfDay(now).toISOString())
      .lte("scheduled_at", endOfDay(now).toISOString()),
    supabase.from("events").select("prize_pool"),
    supabase.from("registrations").select("created_at").gte("created_at", cutoff30d.toISOString()),
    supabase.from("profiles").select("created_at").gte("created_at", usersCutoff.toISOString()),
    supabase.from("teams").select("created_at").gte("created_at", usersCutoff.toISOString()),
    supabase.from("events").select("status"),
  ]);

  const membersByTeam = new Map<string, number>();
  for (const row of teamMembersRes.data ?? []) {
    const teamId = String(row.team_id ?? "");
    if (!teamId) continue;
    membersByTeam.set(teamId, (membersByTeam.get(teamId) ?? 0) + 1);
  }
  const activeTeams = Array.from(membersByTeam.values()).filter((count) => count >= 2).length;

  const totalRevenue = (eventsPrizeRes.data ?? []).reduce((acc, row) => acc + asNumber(row.prize_pool), 0);

  const registrationsMap = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    registrationsMap.set(date.toISOString().slice(0, 10), 0);
  }
  for (const row of registrationsRes.data ?? []) {
    const key = String(row.created_at ?? "").slice(0, 10);
    if (!registrationsMap.has(key)) continue;
    registrationsMap.set(key, (registrationsMap.get(key) ?? 0) + 1);
  }
  const registrations30d: LinePoint[] = Array.from(registrationsMap.entries()).map(([dateKey, total]) => ({
    label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(dateKey)),
    total,
  }));

  const usersByMonthMap = new Map<string, number>();
  const teamsByMonthMap = new Map<string, number>();
  for (let i = usersMonths - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    usersByMonthMap.set(key, 0);
    teamsByMonthMap.set(key, 0);
  }

  for (const row of usersCreatedRes.data ?? []) {
    const created = row.created_at ? new Date(String(row.created_at)) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    if (!usersByMonthMap.has(key)) continue;
    usersByMonthMap.set(key, (usersByMonthMap.get(key) ?? 0) + 1);
  }

  for (const row of teamsCreatedRes.data ?? []) {
    const created = row.created_at ? new Date(String(row.created_at)) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    if (!teamsByMonthMap.has(key)) continue;
    teamsByMonthMap.set(key, (teamsByMonthMap.get(key) ?? 0) + 1);
  }

  const usersByMonth: LinePoint[] = Array.from(usersByMonthMap.entries()).map(([key, total]) => {
    const [year, month] = key.split("-").map((v) => Number(v));
    return { label: monthLabel(new Date(year, month, 1)), total };
  });

  const teamsByMonth: LinePoint[] = Array.from(teamsByMonthMap.entries()).map(([key, total]) => {
    const [year, month] = key.split("-").map((v) => Number(v));
    return { label: monthLabel(new Date(year, month, 1)), total };
  });

  const statusCounts = new Map<string, number>([
    ["draft", 0],
    ["active", 0],
    ["finished", 0],
    ["published", 0],
    ["paused", 0],
  ]);
  for (const row of eventsStatusRes.data ?? []) {
    const status = String(row.status ?? "").toLowerCase();
    if (!statusCounts.has(status)) continue;
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const tournamentStatus: PiePoint[] = [
    { name: "Rascunho", value: statusCounts.get("draft") ?? 0 },
    { name: "Publicado", value: statusCounts.get("published") ?? 0 },
    { name: "Ativo", value: statusCounts.get("active") ?? 0 },
    { name: "Pausado", value: statusCounts.get("paused") ?? 0 },
    { name: "Finalizado", value: statusCounts.get("finished") ?? 0 },
  ];

  return {
    stats: {
      totalUsers: totalUsers ?? 0,
      activeUsers30d: activeUsers30d ?? 0,
      totalTeams: totalTeams ?? 0,
      activeTeams,
      totalTournaments: totalTournaments ?? 0,
      activeTournaments: activeTournaments ?? 0,
      matchesToday: matchesToday ?? 0,
      totalRevenue,
    },
    charts: {
      registrations30d,
      usersByMonth,
      teamsByMonth,
      tournamentStatus,
    },
  };
}

export async function getRecentActivity(limit = 10): Promise<DashboardActivityPayload> {
  const { supabase } = await assertAdminAccess();

  const safeLimit = Math.max(1, Math.min(limit, 30));

  const [usersRes, teamsRes, eventsRes, adminLogsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, updated_at")
      .order("updated_at", { ascending: false })
      .limit(Math.max(10, safeLimit)),
    supabase
      .from("teams")
      .select("name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("events")
      .select("title, status, published_at, created_at")
      .in("status", ["published", "active", "finished"])
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("admin_logs")
      .select("action, entity_type, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const latestLogins = (usersRes.data ?? []).slice(0, 10).map((row) => ({
    title: `Login: ${String(row.display_name ?? row.username ?? "Usuário")}`,
    createdAt: String(row.updated_at ?? new Date().toISOString()),
  }));

  const latestTeams = (teamsRes.data ?? []).slice(0, 5).map((row) => ({
    title: `Equipe criada: ${String(row.name ?? "Equipe")}`,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }));

  const latestPublishedTournaments = (eventsRes.data ?? []).slice(0, 3).map((row) => ({
    title: `Torneio publicado: ${String(row.title ?? "Torneio")}`,
    createdAt: String(row.published_at ?? row.created_at ?? new Date().toISOString()),
  }));

  const latestAdminActions = (adminLogsRes.data ?? []).slice(0, 5).map((row) => ({
    title: `Admin ${String(row.action)} em ${String(row.entity_type)}`,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }));

  return {
    latestLogins,
    latestTeams,
    latestPublishedTournaments,
    latestAdminActions,
  };
}

export async function getAlerts(): Promise<DashboardAlertsPayload> {
  const { supabase } = await assertAdminAccess();

  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const before48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [teamsRes, teamMembersRes, upcomingRes, staleMatchesRes, pendingReqRes] = await Promise.all([
    supabase.from("teams").select("id, name"),
    supabase.from("team_members").select("team_id"),
    supabase
      .from("events")
      .select("id, title, start_date")
      .in("status", ["published", "active"])
      .gte("start_date", now.toISOString())
      .lte("start_date", next24h.toISOString())
      .order("start_date", { ascending: true }),
    supabase
      .from("matches")
      .select("id, event_id, scheduled_at")
      .in("status", ["pending", "in_progress"])
      .lte("scheduled_at", before48h.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50),
    supabase
      .from("team_join_requests")
      .select("user_id")
      .eq("status", "pending"),
  ]);

  const memberCounts = new Map<string, number>();
  for (const row of teamMembersRes.data ?? []) {
    const teamId = String(row.team_id ?? "");
    if (!teamId) continue;
    memberCounts.set(teamId, (memberCounts.get(teamId) ?? 0) + 1);
  }

  const lowMemberTeams = (teamsRes.data ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "Equipe"),
      members: memberCounts.get(String(row.id)) ?? 0,
    }))
    .filter((row) => row.members < 2)
    .slice(0, 20);

  const upcomingTournaments24h = (upcomingRes.data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Torneio"),
    startDate: String(row.start_date),
  }));

  const staleMatches48h = (staleMatchesRes.data ?? []).map((row) => ({
    id: String(row.id),
    eventId: String(row.event_id),
    scheduledAt: String(row.scheduled_at),
  }));

  const pendingByUser = new Map<string, number>();
  for (const row of pendingReqRes.data ?? []) {
    const userId = String(row.user_id ?? "");
    if (!userId) continue;
    pendingByUser.set(userId, (pendingByUser.get(userId) ?? 0) + 1);
  }

  const repeatedUsers = Array.from(pendingByUser.entries())
    .filter(([, total]) => total > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const userIds = repeatedUsers.map(([userId]) => userId);
  const profilesRes = userIds.length
    ? await supabase.from("profiles").select("id, display_name, username").in("id", userIds)
    : { data: [] as Array<{ id: string; display_name: string | null; username: string | null }> };

  const nameByUserId = new Map<string, string>();
  for (const row of profilesRes.data ?? []) {
    nameByUserId.set(String(row.id), String(row.display_name ?? row.username ?? "Usuário"));
  }

  const usersWithMultiplePendingRequests = repeatedUsers.map(([userId, pendingRequests]) => ({
    userId,
    name: nameByUserId.get(userId) ?? "Usuário",
    pendingRequests,
  }));

  return {
    lowMemberTeams,
    upcomingTournaments24h,
    staleMatches48h,
    usersWithMultiplePendingRequests,
  };
}

export async function exportData(type: ExportType) {
  const { supabase } = await assertAdminAccess();

  if (type === "overview") {
    const dashboard = await getDashboardStats();
    const csv = toCsv(
      ["metric", "value"],
      [
        ["total_users", dashboard.stats.totalUsers],
        ["active_users_30d", dashboard.stats.activeUsers30d],
        ["total_teams", dashboard.stats.totalTeams],
        ["active_teams", dashboard.stats.activeTeams],
        ["total_tournaments", dashboard.stats.totalTournaments],
        ["active_tournaments", dashboard.stats.activeTournaments],
        ["matches_today", dashboard.stats.matchesToday],
        ["total_revenue", dashboard.stats.totalRevenue],
      ],
    );

    return {
      fileName: `dashboard-overview-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  if (type === "users") {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, email, role, is_banned, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);

    const csv = toCsv(
      ["id", "display_name", "username", "email", "role", "is_banned", "created_at"],
      (data ?? []).map((row) => [
        row.id,
        row.display_name,
        row.username,
        row.email,
        row.role,
        row.is_banned,
        row.created_at,
      ]),
    );

    return {
      fileName: `users-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  if (type === "teams") {
    const { data } = await supabase
      .from("teams")
      .select("id, name, captain_id, created_at, max_members")
      .order("created_at", { ascending: false })
      .limit(10000);

    const csv = toCsv(
      ["id", "name", "captain_id", "max_members", "created_at"],
      (data ?? []).map((row) => [row.id, row.name, row.captain_id, row.max_members, row.created_at]),
    );

    return {
      fileName: `teams-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  if (type === "events") {
    const { data } = await supabase
      .from("events")
      .select("id, title, status, start_date, end_date, prize_pool, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);

    const csv = toCsv(
      ["id", "title", "status", "start_date", "end_date", "prize_pool", "created_at"],
      (data ?? []).map((row) => [
        row.id,
        row.title,
        row.status,
        row.start_date,
        row.end_date,
        row.prize_pool,
        row.created_at,
      ]),
    );

    return {
      fileName: `events-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  const { data } = await supabase
    .from("registrations")
    .select("id, event_id, team_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);

  const csv = toCsv(
    ["id", "event_id", "team_id", "status", "created_at"],
    (data ?? []).map((row) => [row.id, row.event_id, row.team_id, row.status, row.created_at]),
  );

  return {
    fileName: `registrations-${new Date().toISOString().slice(0, 10)}.csv`,
    content: csv,
    mimeType: "text/csv;charset=utf-8",
  };
}
